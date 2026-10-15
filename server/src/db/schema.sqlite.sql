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

-- 바이어(고객사)
CREATE TABLE IF NOT EXISTS buyers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- 오더: 바이어가 특정 스타일(product)을 발주
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  style_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  order_date TEXT NOT NULL DEFAULT (date('now')),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'placed', -- placed | in_production | shipped | completed | cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 생산 진행 로그: 재단/봉제/마무리 등 공정 단계별 진행 수량
CREATE TABLE IF NOT EXISTS production_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  factory TEXT NOT NULL,
  stage TEXT NOT NULL, -- cutting | sewing | finishing
  quantity_completed INTEGER NOT NULL,
  log_date TEXT NOT NULL DEFAULT (date('now'))
);

-- 선적
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier TEXT,
  port TEXT,
  etd TEXT,
  eta TEXT,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked', -- booked | departed | arrived
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 회계: 오더 단위 인보이스
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  issue_date TEXT NOT NULL DEFAULT (date('now')),
  due_date TEXT,
  paid INTEGER NOT NULL DEFAULT 0
);

-- 인사: 직원 디렉터리
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT NOT NULL, -- 오더/생산/선적/회계/인사 등
  position TEXT,
  hire_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_style ON orders(style_id);
CREATE INDEX IF NOT EXISTS idx_production_order ON production_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
