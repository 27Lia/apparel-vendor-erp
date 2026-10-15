import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Railway 등은 서비스당 Volume을 1개만 붙일 수 있어서,
// DB 파일과 업로드 이미지를 같은 디렉토리(dataDir) 아래에 둬서 Volume 하나로 같이 영속시킨다.
export const dataDir = path.join(__dirname, "..", "data");
export const uploadsDir = path.join(dataDir, "uploads");
