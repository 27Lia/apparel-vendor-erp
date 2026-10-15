import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "app.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schema = fs.readFileSync(path.join(__dirname, "schema.sqlite.sql"), "utf-8");
db.exec(schema);

// 기존 products.brand 값을 바이어 마스터로 이관 (최초 1회성, idempotent)
const brands = db
  .prepare("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL")
  .all() as { brand: string }[];
const insertBuyer = db.prepare("INSERT OR IGNORE INTO buyers (name) VALUES (?)");
for (const { brand } of brands) insertBuyer.run(brand);
