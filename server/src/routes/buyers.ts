import { Router } from "express";
import { db } from "../db/client.js";
import type { BuyerRow } from "../types.js";

export const buyersRouter = Router();

buyersRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM buyers ORDER BY name").all() as BuyerRow[];
  res.json(rows);
});

buyersRouter.post("/", (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: "name이 필요합니다." });

  try {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO buyers (name) VALUES (?)")
      .run(name.trim());
    res.status(201).json({ id: lastInsertRowid, name: name.trim() });
  } catch {
    res.status(409).json({ error: "이미 존재하는 바이어입니다." });
  }
});
