import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "../db/client.js";
import { tagImage } from "../services/tagging.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
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

    const finalPath = `${file.filename}${path.extname(file.originalname)}`;
    fs.renameSync(file.path, path.join(uploadsDir, finalPath));

    const insertProduct = db.prepare(
      "INSERT INTO products (name, brand, image_path) VALUES (?, ?, ?)"
    );
    const findTag = db.prepare("SELECT id FROM tags WHERE type = ? AND value = ?");
    const insertTag = db.prepare("INSERT INTO tags (type, value) VALUES (?, ?)");
    const linkTag = db.prepare(
      "INSERT OR IGNORE INTO product_tags (product_id, tag_id, confidence) VALUES (?, ?, ?)"
    );

    const productId = db.transaction(() => {
      const { lastInsertRowid } = insertProduct.run(result.name, result.brand, finalPath);
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
