import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { db } from "../db/client.js";
import { tagImage } from "../services/tagging.js";
import { uploadsDir } from "../config.js";

fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir, limits: { fileSize: 10 * 1024 * 1024 } });

export const uploadRouter = Router();

uploadRouter.post("/", upload.single("image"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "image 파일이 필요합니다." });
  }

  try {
    const buffer = fs.readFileSync(file.path);
    const result = await tagImage(buffer, file.mimetype, file.originalname);

    // 폼으로 브랜드/상품명을 직접 넘기면 AI 추정값을 덮어씀 (AI가 로고를 못 읽는 경우 보정용)
    if (typeof req.body.brand === "string" && req.body.brand.trim()) {
      result.brand = req.body.brand.trim();
    }
    if (typeof req.body.name === "string" && req.body.name.trim()) {
      result.name = req.body.name.trim();
    }
    // 시딩용: 색상 스와치 이미지라 AI가 카테고리를 모양으로 못 읽을 때 태그를 직접 지정
    if (typeof req.body.tags === "string" && req.body.tags.trim()) {
      result.tags = JSON.parse(req.body.tags);
    }

    const finalPath = `${file.filename}${path.extname(file.originalname)}`;
    fs.renameSync(file.path, path.join(uploadsDir, finalPath));

    const insertProduct = db.prepare(
      "INSERT INTO products (name, brand, image_path) VALUES (?, ?, ?)"
    );
    const insertBuyer = db.prepare("INSERT OR IGNORE INTO buyers (name) VALUES (?)");
    const findTag = db.prepare("SELECT id FROM tags WHERE type = ? AND value = ?");
    const insertTag = db.prepare("INSERT INTO tags (type, value) VALUES (?, ?)");
    const linkTag = db.prepare(
      "INSERT OR IGNORE INTO product_tags (product_id, tag_id, confidence) VALUES (?, ?, ?)"
    );

    const productId = db.transaction(() => {
      const { lastInsertRowid } = insertProduct.run(result.name, result.brand, finalPath);
      // 새 브랜드로 업로드되면 바이어 마스터에도 바로 반영 (오더 등록 화면 Select에 즉시 뜨게)
      if (result.brand) insertBuyer.run(result.brand);
      for (const tag of result.tags) {
        let tagRow = findTag.get(tag.type, tag.value) as { id: number } | undefined;
        if (!tagRow) {
          const { lastInsertRowid: tagId } = insertTag.run(tag.type, tag.value);
          tagRow = { id: Number(tagId) };
        }
        linkTag.run(lastInsertRowid, tagRow.id, tag.confidence);
      }
      return lastInsertRowid;
    })();

    res.status(201).json({ productId, ...result, imagePath: finalPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "태깅/저장 중 오류가 발생했습니다." });
  }
});
