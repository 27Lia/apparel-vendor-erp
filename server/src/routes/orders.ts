import { Router } from "express";
import { db } from "../db/client.js";
import type { OrderRow, ProductionLogRow, ShipmentRow, InvoiceRow } from "../types.js";

export const ordersRouter = Router();

// 오더 현황 대시보드: orders를 기준으로 buyers/products를 JOIN하고,
// 생산 완료 수량(SUM) / 최신 선적 상태 / 최신 인보이스 결제여부를 서브쿼리로 붙인다.
// (schema.mssql.sql의 dbo.GetOrderDashboard 저장 프로시저와 동일한 로직)
ordersRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT
         o.id, o.order_no, o.quantity, o.due_date, o.status, o.order_date,
         b.name AS buyer_name,
         p.name AS style_name,
         p.image_path AS style_image,
         COALESCE((
           SELECT SUM(quantity_completed) FROM production_logs pl
           WHERE pl.order_id = o.id AND pl.stage = 'finishing'
         ), 0) AS produced_qty,
         (SELECT status FROM shipments s WHERE s.order_id = o.id ORDER BY s.id DESC LIMIT 1) AS shipment_status,
         (SELECT paid FROM invoices i WHERE i.order_id = o.id ORDER BY i.id DESC LIMIT 1) AS invoice_paid
       FROM orders o
       JOIN buyers b ON b.id = o.buyer_id
       JOIN products p ON p.id = o.style_id
       ORDER BY o.created_at DESC`
    )
    .all();

  res.json(rows);
});

ordersRouter.post("/", (req, res) => {
  const { order_no, buyer_id, style_id, quantity, due_date } = req.body as Partial<OrderRow>;
  if (!order_no?.trim() || !buyer_id || !style_id || !quantity) {
    return res.status(400).json({ error: "order_no, buyer_id, style_id, quantity는 필수입니다." });
  }

  try {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO orders (order_no, buyer_id, style_id, quantity, due_date)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(order_no.trim(), buyer_id, style_id, quantity, due_date ?? null);
    res.status(201).json({ id: lastInsertRowid });
  } catch {
    res.status(409).json({ error: "이미 존재하는 오더번호입니다." });
  }
});

ordersRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const order = db
    .prepare(
      `SELECT o.*, b.name AS buyer_name, p.name AS style_name, p.image_path AS style_image
       FROM orders o
       JOIN buyers b ON b.id = o.buyer_id
       JOIN products p ON p.id = o.style_id
       WHERE o.id = ?`
    )
    .get(id);
  if (!order) return res.status(404).json({ error: "오더를 찾을 수 없습니다." });

  const production = db
    .prepare("SELECT * FROM production_logs WHERE order_id = ? ORDER BY log_date, id")
    .all(id) as ProductionLogRow[];
  const shipments = db
    .prepare("SELECT * FROM shipments WHERE order_id = ? ORDER BY id DESC")
    .all(id) as ShipmentRow[];
  const invoices = db
    .prepare("SELECT * FROM invoices WHERE order_id = ? ORDER BY id DESC")
    .all(id) as InvoiceRow[];

  res.json({ ...order, production, shipments, invoices });
});

ordersRouter.patch("/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status?: OrderRow["status"] };
  if (!status) return res.status(400).json({ error: "status가 필요합니다." });

  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  res.json({ ok: true });
});

ordersRouter.post("/:id/production", (req, res) => {
  const orderId = Number(req.params.id);
  const { factory, stage, quantity_completed, log_date } = req.body as Partial<ProductionLogRow>;
  if (!factory?.trim() || !stage || !quantity_completed) {
    return res.status(400).json({ error: "factory, stage, quantity_completed는 필수입니다." });
  }

  const insertLog = db.prepare(
    `INSERT INTO production_logs (order_id, factory, stage, quantity_completed, log_date)
     VALUES (?, ?, ?, ?, COALESCE(?, date('now')))`
  );
  const bumpStatus = db.prepare(
    "UPDATE orders SET status = 'in_production' WHERE id = ? AND status = 'placed'"
  );

  const logId = db.transaction(() => {
    const { lastInsertRowid } = insertLog.run(
      orderId,
      factory.trim(),
      stage,
      quantity_completed,
      log_date ?? null
    );
    bumpStatus.run(orderId);
    return lastInsertRowid;
  })();

  res.status(201).json({ id: logId });
});

ordersRouter.post("/:id/shipment", (req, res) => {
  const orderId = Number(req.params.id);
  const { carrier, port, etd, eta, quantity, status } = req.body as Partial<ShipmentRow>;
  if (!quantity) return res.status(400).json({ error: "quantity는 필수입니다." });

  const insertShipment = db.prepare(
    `INSERT INTO shipments (order_id, carrier, port, etd, eta, quantity, status)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 'booked'))`
  );
  const bumpStatus = db.prepare(
    "UPDATE orders SET status = 'shipped' WHERE id = ? AND status != 'completed'"
  );

  const shipmentId = db.transaction(() => {
    const { lastInsertRowid } = insertShipment.run(
      orderId,
      carrier ?? null,
      port ?? null,
      etd ?? null,
      eta ?? null,
      quantity,
      status ?? null
    );
    bumpStatus.run(orderId);
    return lastInsertRowid;
  })();

  res.status(201).json({ id: shipmentId });
});

ordersRouter.post("/:id/invoice", (req, res) => {
  const orderId = Number(req.params.id);
  const { amount, currency, due_date } = req.body as Partial<InvoiceRow>;
  if (!amount) return res.status(400).json({ error: "amount는 필수입니다." });

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO invoices (order_id, amount, currency, due_date)
       VALUES (?, ?, COALESCE(?, 'USD'), ?)`
    )
    .run(orderId, amount, currency ?? null, due_date ?? null);

  res.status(201).json({ id: lastInsertRowid });
});

ordersRouter.patch("/:orderId/invoice/:invoiceId/paid", (req, res) => {
  const { invoiceId } = req.params;
  const { paid } = req.body as { paid?: boolean };
  db.prepare("UPDATE invoices SET paid = ? WHERE id = ?").run(paid ? 1 : 0, invoiceId);
  res.json({ ok: true });
});
