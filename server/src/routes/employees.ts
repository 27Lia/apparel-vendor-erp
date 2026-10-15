import { Router } from "express";
import { db } from "../db/client.js";
import type { EmployeeRow } from "../types.js";

export const employeesRouter = Router();

employeesRouter.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM employees ORDER BY department, name")
    .all() as EmployeeRow[];
  res.json(rows);
});

employeesRouter.post("/", (req, res) => {
  const { name, department, position, hire_date } = req.body as Partial<EmployeeRow>;
  if (!name?.trim() || !department?.trim()) {
    return res.status(400).json({ error: "name, department는 필수입니다." });
  }

  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO employees (name, department, position, hire_date) VALUES (?, ?, ?, ?)"
    )
    .run(name.trim(), department.trim(), position ?? null, hire_date ?? null);

  res.status(201).json({ id: lastInsertRowid, name, department, position, hire_date });
});

employeesRouter.delete("/:id", (req, res) => {
  const result = db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "직원을 찾을 수 없습니다." });
  res.json({ ok: true });
});
