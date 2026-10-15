import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uploadRouter } from "./routes/upload.js";
import { productsRouter } from "./routes/products.js";
import { buyersRouter } from "./routes/buyers.js";
import { ordersRouter } from "./routes/orders.js";
import { employeesRouter } from "./routes/employees.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/upload", uploadRouter);
app.use("/api/products", productsRouter);
app.use("/api/buyers", buyersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/employees", employeesRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiMode: process.env.ANTHROPIC_API_KEY ? "claude" : "mock" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
