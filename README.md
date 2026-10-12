# 상품 이미지 태깅 · 검색

이미지를 업로드하면 AI가 색상/카테고리/스타일을 자동 태깅해서 DB에 저장하고,
브랜드·색상·카테고리·스타일 조합으로 검색(SELECT + JOIN)할 수 있는 작은 앱입니다.

- 실행 DB: SQLite (로컬에 Docker 없이 바로 돌리기 위함)
- `server/src/db/schema.mssql.sql`: 동일한 테이블/검색 로직을 T-SQL(MS-SQL)로 옮겨 적은 참고용 스키마 + 저장 프로시저
- AI 태깅: Claude API (vision). `ANTHROPIC_API_KEY`가 없으면 mock 태깅으로 전체 플로우 테스트 가능

## 실행

```bash
pnpm install
cp server/.env.example server/.env   # 필요하면 ANTHROPIC_API_KEY 채우기
pnpm dev
```

- 서버: http://localhost:4000
- 웹: http://localhost:5173

## 구조

```
server/   Express + better-sqlite3 + Claude Vision 태깅
web/      React + Vite 업로드/검색 UI
```

## 핵심 쿼리

`server/src/routes/products.ts`에서 선택된 필터(브랜드/색상/카테고리/스타일)마다
`product_tags`/`tags`를 EXISTS + JOIN으로 묶어 교집합을 구합니다.
같은 로직을 MS-SQL 저장 프로시저(`dbo.SearchProducts`)로도 작성해뒀습니다.
