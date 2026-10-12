import { Router } from "express";
import { db } from "../db/client.js";
import type { ProductRow } from "../types.js";

export const productsRouter = Router();

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

  res.json(
    rows.map((p) => ({
      ...p,
      tags: grouped.get(p.id) ?? [],
    }))
  );
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
