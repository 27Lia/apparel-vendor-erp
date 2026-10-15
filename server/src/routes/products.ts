import { Router } from "express";
import { db } from "../db/client.js";
import { tagsFromText } from "../services/tagging.js";
import type { ProductRow } from "../types.js";

export const productsRouter = Router();

function attachTags<T extends { id: number }>(rows: T[]) {
  const tagsByProduct = db
    .prepare(
      `SELECT pt.product_id, t.type, t.value
       FROM product_tags pt
       JOIN tags t ON t.id = pt.tag_id`
    )
    .all() as { product_id: number; type: string; value: string }[];

  const grouped = new Map<number, { type: string; value: string }[]>();
  for (const row of tagsByProduct) {
    if (!grouped.has(row.product_id)) grouped.set(row.product_id, []);
    grouped.get(row.product_id)!.push({ type: row.type, value: row.value });
  }

  return rows.map((p) => ({ ...p, tags: grouped.get(p.id) ?? [] }));
}

// 브랜드 + 색상 + 카테고리 + 스타일 조합 검색.
// products / product_tags / tags를 조건별로 EXISTS+JOIN 해서 교집합을 구한다.
// (schema.mssql.sql의 dbo.SearchProducts 저장 프로시저와 동일한 로직)
productsRouter.get("/", (req, res) => {
  const { brand, color, category, style } = req.query as Record<string, string | undefined>;

  const conditions: string[] = [];
  const params: string[] = [];

  if (brand) {
    conditions.push("p.brand = ?");
    params.push(brand);
  }
  for (const [type, value] of [
    ["color", color],
    ["category", category],
    ["style", style],
  ] as const) {
    if (value) {
      conditions.push(`EXISTS (
        SELECT 1 FROM product_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.product_id = p.id AND t.type = ? AND t.value = ?
      )`);
      params.push(type, value);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.brand, p.image_path, p.created_at
       FROM products p
       ${where}
       ORDER BY p.created_at DESC`
    )
    .all(...params) as ProductRow[];

  res.json(attachTags(rows));
});

// 상품 정보 수정: AI가 잘못 판단한 브랜드/이름/태그를 사람이 직접 고칠 수 있게.
productsRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, brand, tags } = req.body as {
    name?: string;
    brand?: string | null;
    tags?: { type: "color" | "category" | "style"; value: string; confidence?: number }[];
  };

  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });

  const updateProduct = db.prepare(
    "UPDATE products SET name = COALESCE(?, name), brand = ? WHERE id = ?"
  );
  const insertBuyer = db.prepare("INSERT OR IGNORE INTO buyers (name) VALUES (?)");
  const clearTags = db.prepare("DELETE FROM product_tags WHERE product_id = ?");
  const findTag = db.prepare("SELECT id FROM tags WHERE type = ? AND value = ?");
  const insertTag = db.prepare("INSERT INTO tags (type, value) VALUES (?, ?)");
  const linkTag = db.prepare(
    "INSERT OR IGNORE INTO product_tags (product_id, tag_id, confidence) VALUES (?, ?, ?)"
  );

  db.transaction(() => {
    updateProduct.run(name ?? null, brand === undefined ? null : brand, id);
    if (brand) insertBuyer.run(brand);
    if (tags) {
      clearTags.run(id);
      for (const tag of tags) {
        let tagRow = findTag.get(tag.type, tag.value) as { id: number } | undefined;
        if (!tagRow) {
          const { lastInsertRowid } = insertTag.run(tag.type, tag.value);
          tagRow = { id: Number(lastInsertRowid) };
        }
        linkTag.run(id, tagRow.id, tag.confidence ?? null);
      }
    }
  })();

  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow;
  res.json(attachTags([row])[0]);
});

productsRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
  res.json({ ok: true });
});

// 특정 상품과 태그를 가장 많이 공유하는 상품을 찾는 "비슷한 상품" 추천.
// product_tags를 tag_id 기준으로 자기 자신과 JOIN해서, 겹치는 태그 개수로 랭킹한다.
productsRouter.get("/:id/similar", (req, res) => {
  const id = Number(req.params.id);
  const limit = Number(req.query.limit) || 8;

  const rows = db
    .prepare(
      `SELECT p2.id, p2.name, p2.brand, p2.image_path, p2.created_at,
              COUNT(*) AS shared_tags
       FROM product_tags pt1
       JOIN product_tags pt2 ON pt2.tag_id = pt1.tag_id AND pt2.product_id != pt1.product_id
       JOIN products p2 ON p2.id = pt2.product_id
       WHERE pt1.product_id = ?
       GROUP BY p2.id
       ORDER BY shared_tags DESC, p2.created_at DESC
       LIMIT ?`
    )
    .all(id, limit) as (ProductRow & { shared_tags: number })[];

  res.json(attachTags(rows));
});

// 문장으로 유사 스타일 찾기: AI로 문장 -> 태그 추출 후, 태그 겹치는 개수로 상품을 랭킹.
productsRouter.get("/search/text", async (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (!query) return res.json([]);

  try {
    const tags = await tagsFromText(query);
    if (tags.length === 0) return res.json([]);

    const findTag = db.prepare("SELECT id FROM tags WHERE type = ? AND value = ?");
    const tagIds = tags
      .map((t) => findTag.get(t.type, t.value) as { id: number } | undefined)
      .filter((row): row is { id: number } => !!row)
      .map((row) => row.id);

    if (tagIds.length === 0) return res.json([]);

    const placeholders = tagIds.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.brand, p.image_path, p.created_at,
                COUNT(DISTINCT pt.tag_id) AS matched_tags
         FROM products p
         JOIN product_tags pt ON pt.product_id = p.id
         WHERE pt.tag_id IN (${placeholders})
         GROUP BY p.id
         ORDER BY matched_tags DESC, p.created_at DESC
         LIMIT 20`
      )
      .all(...tagIds) as (ProductRow & { matched_tags: number })[];

    res.json({ matchedTags: tags, results: attachTags(rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "유사 검색 중 오류가 발생했습니다." });
  }
});

// 검색 폼 채울 때 쓰는 필터 옵션 목록 (실제 저장된 태그에서 뽑음)
productsRouter.get("/filters", (_req, res) => {
  const rows = db
    .prepare("SELECT DISTINCT type, value FROM tags ORDER BY type, value")
    .all() as { type: string; value: string }[];

  const brands = db
    .prepare("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL ORDER BY brand")
    .all() as { brand: string }[];

  const byType: Record<string, string[]> = { color: [], category: [], style: [] };
  for (const row of rows) {
    byType[row.type]?.push(row.value);
  }

  res.json({ brands: brands.map((b) => b.brand), ...byType });
});
