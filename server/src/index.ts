import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uploadRouter } from "./routes/upload.js";
import { productsRouter } from "./routes/products.js";
import { buyersRouter } from "./routes/buyers.js";
import { ordersRouter } from "./routes/orders.js";
import { employeesRouter } from "./routes/employees.js";
import { uploadsDir } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.use("/api/upload", uploadRouter);
app.use("/api/products", productsRouter);
app.use("/api/buyers", buyersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/employees", employeesRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiMode: process.env.ANTHROPIC_API_KEY ? "claude" : "mock" });
});

// 배포 시 프론트엔드 빌드 결과물(web/dist)을 같은 서버에서 같이 서빙.
// 로컬 개발(pnpm dev)에서는 web/dist가 없어서 이 블록이 그냥 건너뛰어짐.
const webDist = path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
