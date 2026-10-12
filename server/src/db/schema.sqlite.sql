-- 실행용 스키마 (SQLite). 로컬에 Docker/MS-SQL 없이 바로 돌리기 위한 버전.
-- 쿼리 구조(JOIN 조합, 저장 프로시저 로직)는 schema.mssql.sql의 T-SQL 버전과 동일하게 맞춤.

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT,
  image_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- type: 'color' | 'category' | 'style'
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  UNIQUE (type, value)
);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  confidence REAL,
  PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_type_value ON tags(type, value);
