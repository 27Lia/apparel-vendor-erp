-- 참고용 T-SQL(MS-SQL) 스키마 + 저장 프로시저.
-- 로컬 개발 환경에는 Docker가 없어서 실제 MS-SQL에는 붙이지 않았고,
-- 앱 동작은 schema.sqlite.sql(SQLite)로 돌아간다.
-- 다만 자격요건(MS-SQL 쿼리/저장 프로시저 작성)을 보여주기 위해
-- 동일한 테이블 구조와 검색 로직을 T-SQL 문법으로 옮겨 적어둔다.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'products')
BEGIN
  CREATE TABLE dbo.products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    brand NVARCHAR(100) NULL,
    image_path NVARCHAR(500) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tags')
BEGIN
  CREATE TABLE dbo.tags (
    id INT IDENTITY(1,1) PRIMARY KEY,
    type NVARCHAR(20) NOT NULL,   -- 'color' | 'category' | 'style'
    value NVARCHAR(100) NOT NULL,
    CONSTRAINT UQ_tags_type_value UNIQUE (type, value)
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'product_tags')
BEGIN
  CREATE TABLE dbo.product_tags (
    product_id INT NOT NULL FOREIGN KEY REFERENCES dbo.products(id) ON DELETE CASCADE,
    tag_id INT NOT NULL FOREIGN KEY REFERENCES dbo.tags(id) ON DELETE CASCADE,
    confidence DECIMAL(4,3) NULL,
    CONSTRAINT PK_product_tags PRIMARY KEY (product_id, tag_id)
  );
  CREATE INDEX IX_product_tags_tag ON dbo.product_tags(tag_id);
END
GO

-- 브랜드/색상/카테고리/스타일 조합 검색.
-- 조건이 넘어온 태그 타입마다 EXISTS로 product_tags/tags를 JOIN해서
-- 모든 조건을 동시에 만족하는 상품만 걸러낸다(AND 교집합).
CREATE OR ALTER PROCEDURE dbo.SearchProducts
  @Brand NVARCHAR(100) = NULL,
  @Color NVARCHAR(100) = NULL,
  @Category NVARCHAR(100) = NULL,
  @Style NVARCHAR(100) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    p.id,
    p.name,
    p.brand,
    p.image_path,
    p.created_at
  FROM dbo.products AS p
  WHERE (@Brand IS NULL OR p.brand = @Brand)
    AND (@Color IS NULL OR EXISTS (
          SELECT 1
          FROM dbo.product_tags pt
          JOIN dbo.tags t ON t.id = pt.tag_id
          WHERE pt.product_id = p.id AND t.type = 'color' AND t.value = @Color
        ))
    AND (@Category IS NULL OR EXISTS (
          SELECT 1
          FROM dbo.product_tags pt
          JOIN dbo.tags t ON t.id = pt.tag_id
          WHERE pt.product_id = p.id AND t.type = 'category' AND t.value = @Category
        ))
    AND (@Style IS NULL OR EXISTS (
          SELECT 1
          FROM dbo.product_tags pt
          JOIN dbo.tags t ON t.id = pt.tag_id
          WHERE pt.product_id = p.id AND t.type = 'style' AND t.value = @Style
        ))
  ORDER BY p.created_at DESC;
END
GO

-- 상품별 태그를 한 줄로 묶어 보여주는 조회(오류 데이터 점검용으로도 씀).
-- STRING_AGG + JOIN 사용 예시.
SELECT
  p.id,
  p.name,
  p.brand,
  STRING_AGG(t.type + ':' + t.value, ', ') AS tags
FROM dbo.products AS p
JOIN dbo.product_tags AS pt ON pt.product_id = p.id
JOIN dbo.tags AS t ON t.id = pt.tag_id
GROUP BY p.id, p.name, p.brand;
GO

-- =========================================================
-- ERP 핵심 테이블: 바이어 / 오더 / 생산 / 선적 / 회계 / 인사
-- =========================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'buyers')
BEGIN
  CREATE TABLE dbo.buyers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'orders')
BEGIN
  CREATE TABLE dbo.orders (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_no NVARCHAR(50) NOT NULL UNIQUE,
    buyer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.buyers(id),
    style_id INT NOT NULL FOREIGN KEY REFERENCES dbo.products(id),
    quantity INT NOT NULL,
    order_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    due_date DATE NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'placed', -- placed | in_production | shipped | completed | cancelled
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'production_logs')
BEGIN
  CREATE TABLE dbo.production_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL FOREIGN KEY REFERENCES dbo.orders(id) ON DELETE CASCADE,
    factory NVARCHAR(100) NOT NULL,
    stage NVARCHAR(20) NOT NULL, -- cutting | sewing | finishing
    quantity_completed INT NOT NULL,
    log_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE)
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'shipments')
BEGIN
  CREATE TABLE dbo.shipments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL FOREIGN KEY REFERENCES dbo.orders(id) ON DELETE CASCADE,
    carrier NVARCHAR(100) NULL,
    port NVARCHAR(100) NULL,
    etd DATE NULL,
    eta DATE NULL,
    quantity INT NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'booked' -- booked | departed | arrived
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'invoices')
BEGIN
  CREATE TABLE dbo.invoices (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL FOREIGN KEY REFERENCES dbo.orders(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    currency NVARCHAR(10) NOT NULL DEFAULT 'USD',
    issue_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    due_date DATE NULL,
    paid BIT NOT NULL DEFAULT 0
  );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'employees')
BEGIN
  CREATE TABLE dbo.employees (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    department NVARCHAR(50) NOT NULL,
    position NVARCHAR(50) NULL,
    hire_date DATE NULL
  );
END
GO

-- 오더 현황 대시보드: 바이어명 + 스타일명 + 최신 생산 진행률 + 선적 상태 + 결제 여부를
-- orders를 기준으로 5개 테이블 JOIN/서브쿼리로 한 번에 모은다.
CREATE OR ALTER PROCEDURE dbo.GetOrderDashboard
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    o.id,
    o.order_no,
    b.name AS buyer_name,
    p.name AS style_name,
    o.quantity,
    o.due_date,
    o.status,
    ISNULL(prod.produced_qty, 0) AS produced_qty,
    CAST(ISNULL(prod.produced_qty, 0) AS FLOAT) / o.quantity AS production_rate,
    sh.status AS shipment_status,
    inv.paid AS invoice_paid
  FROM dbo.orders o
  JOIN dbo.buyers b ON b.id = o.buyer_id
  JOIN dbo.products p ON p.id = o.style_id
  OUTER APPLY (
    SELECT SUM(quantity_completed) AS produced_qty
    FROM dbo.production_logs pl
    WHERE pl.order_id = o.id AND pl.stage = 'finishing'
  ) prod
  OUTER APPLY (
    SELECT TOP 1 status FROM dbo.shipments s
    WHERE s.order_id = o.id ORDER BY s.id DESC
  ) sh
  OUTER APPLY (
    SELECT TOP 1 paid FROM dbo.invoices i
    WHERE i.order_id = o.id ORDER BY i.id DESC
  ) inv
  ORDER BY o.created_at DESC;
END
GO
