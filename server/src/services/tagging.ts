import Anthropic from "@anthropic-ai/sdk";
import type { Tag, TaggingResult } from "../types.js";

const COLORS = ["black", "white", "navy", "beige", "red", "blue", "green", "gray"];
const CATEGORIES = ["top", "bottom", "outer", "dress", "shoes", "bag"];
const STYLES = ["casual", "formal", "sporty", "street", "minimal"];

function mockTagging(filename: string): TaggingResult {
  // API 키 없이도 전체 플로우(업로드→태깅→DB저장→검색)를 확인할 수 있도록
  // 파일명을 시드로 써서 매번 같은 입력에 같은 태그가 나오게 만든 더미 로직.
  let seed = 0;
  for (const ch of filename) seed += ch.charCodeAt(0);

  return {
    name: filename.replace(/\.[^.]+$/, ""),
    brand: null,
    tags: [
      { type: "color", value: COLORS[seed % COLORS.length], confidence: 0.6 },
      { type: "category", value: CATEGORIES[seed % CATEGORIES.length], confidence: 0.6 },
      { type: "style", value: STYLES[seed % STYLES.length], confidence: 0.6 },
    ],
  };
}

async function claudeTagging(imageBuffer: Buffer, mediaType: string, filename: string): Promise<TaggingResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
              data: imageBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text:
              "이 의류/상품 이미지를 분석해서 아래 JSON 형식으로만 답해줘. 다른 설명은 붙이지 마.\n" +
              `{"name": "짧은 상품명", "brand": "로고로 보이는 브랜드명 또는 null", ` +
              `"tags": [{"type": "color", "value": "...", "confidence": 0.0~1.0}, ` +
              `{"type": "category", "value": "...", "confidence": 0.0~1.0}, ` +
              `{"type": "style", "value": "...", "confidence": 0.0~1.0}]}\n` +
              `color는 ${COLORS.join("/")} 중, category는 ${CATEGORIES.join("/")} 중, ` +
              `style은 ${STYLES.join("/")} 중에서 가장 가까운 값으로 골라줘.`,
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude 응답에서 텍스트를 찾지 못함");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude 응답에서 JSON을 찾지 못함: " + textBlock.text);
  }

  const parsed = JSON.parse(jsonMatch[0]) as TaggingResult;
  if (!parsed.name) parsed.name = filename.replace(/\.[^.]+$/, "");
  return parsed;
}

export async function tagImage(imageBuffer: Buffer, mediaType: string, filename: string): Promise<TaggingResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockTagging(filename);
  }
  return claudeTagging(imageBuffer, mediaType, filename);
}

function mockTagsFromText(query: string): Tag[] {
  // 키 없이도 동작 확인용: 문장에 vocabulary 단어가 그대로 들어있으면 매칭.
  const lower = query.toLowerCase();
  const tags: Tag[] = [];
  for (const value of COLORS) if (lower.includes(value)) tags.push({ type: "color", value, confidence: 0.5 });
  for (const value of CATEGORIES) if (lower.includes(value)) tags.push({ type: "category", value, confidence: 0.5 });
  for (const value of STYLES) if (lower.includes(value)) tags.push({ type: "style", value, confidence: 0.5 });
  return tags;
}

async function claudeTagsFromText(query: string): Promise<Tag[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content:
          `다음 문장에서 의류 상품 특징을 뽑아서 JSON 배열로만 답해줘. 다른 설명은 붙이지 마.\n` +
          `문장: "${query}"\n` +
          `형식: [{"type": "color", "value": "..."}, ...]\n` +
          `type은 color/category/style 중에서만, color는 ${COLORS.join("/")} 중, ` +
          `category는 ${CATEGORIES.join("/")} 중, style은 ${STYLES.join("/")} 중에서 ` +
          `문장과 관련 있는 값만 골라줘. 관련 없으면 빈 배열로 답해도 됨.`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]) as Partial<Tag>[];
  return parsed
    .filter((t): t is Partial<Tag> & Pick<Tag, "type" | "value"> => !!t.type && !!t.value)
    .map((t) => ({ ...t, confidence: t.confidence ?? 0.7 }));
}

export async function tagsFromText(query: string): Promise<Tag[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockTagsFromText(query);
  }
  return claudeTagsFromText(query);
}
