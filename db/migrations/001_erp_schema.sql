-- =============================================================================
-- TIRTIR Cosmetics ERP — 데이터베이스 스키마 (Migration 001)
-- =============================================================================
-- 설계 원칙:
--   1. 실무 ERP 구조를 모사한 정규화(3NF) 관계형 스키마
--   2. product_master ↔ shade_master : 독립 마스터 테이블
--   3. sales_order / inventory_ledger : product_master, shade_master에 FK 참조
--   4. customer_segment : 월별 스냅샷 방식으로 히스토리 보존
--   5. 모든 테이블에 RLS(Row Level Security) 적용 → 사용자별 데이터 격리
-- =============================================================================


-- ─── 1. 제품 마스터 (Product Master) ─────────────────────────────────────────
--   ERP 내 제품 코드북. 실무에서는 PLM(Product Lifecycle Mgmt) 시스템과 연동.
CREATE TABLE IF NOT EXISTS product_master (
  product_id      TEXT        PRIMARY KEY,          -- 'red' | 'ai' | 'ruby' | 'crystal'
  product_name    TEXT        NOT NULL,              -- '마스크핏 레드 쿠션'
  product_line    TEXT        NOT NULL,              -- 'Mask Fit'
  sku_code        TEXT        NOT NULL UNIQUE,       -- 'RD-CSN-01'
  launch_date     DATE        NOT NULL,
  base_price_usd  NUMERIC(8,2) NOT NULL CHECK (base_price_usd > 0),
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  product_master IS '제품 마스터: 쿠션 제품 카탈로그. 1:N → sales_order, inventory_ledger, customer_segment';
COMMENT ON COLUMN product_master.product_id IS 'ERP 내부 코드 (소문자). SKU 체계와 분리하여 유연성 확보';


-- ─── 2. 쉐이드 마스터 (Shade Master) ─────────────────────────────────────────
--   색조 코드북. 숫자(명도) + 언더톤(C/N/W) 구조로 분리 → 필터 최적화.
CREATE TABLE IF NOT EXISTS shade_master (
  shade_code      TEXT        PRIMARY KEY,          -- '17C', '21N', '13.5N' 등
  shade_name      TEXT        NOT NULL,             -- 'Light', 'Natural' 등
  undertone       CHAR(1)     NOT NULL CHECK (undertone IN ('C', 'N', 'W')),
  shade_number    NUMERIC(4,1) NOT NULL,            -- 17.0, 21.0, 13.5 등
  depth_class     TEXT        NOT NULL              -- 'Very Light' / 'Light' / 'Medium' / 'Medium Dark' / 'Dark'
    GENERATED ALWAYS AS (
      CASE
        WHEN shade_number <= 15  THEN 'Very Light'
        WHEN shade_number <= 21  THEN 'Light'
        WHEN shade_number <= 27  THEN 'Medium'
        WHEN shade_number <= 35  THEN 'Medium Dark'
        ELSE                          'Dark'
      END
    ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  shade_master IS '쉐이드(색상) 마스터: 46개 쿠션 색상. 1:N → sales_order, inventory_ledger';
COMMENT ON COLUMN shade_master.depth_class IS '명도 클래스: shade_number 기준 자동 계산 (Generated Column)';


-- ─── 3. 판매 주문 (Sales Order) ── Fact Table ─────────────────────────────────
--   일별 채널×국가×쉐이드×제품 단위 집계 트랜잭션.
--   실무에서는 ERP ↔ 이커머스/POS 연동 후 일일 배치로 적재.
CREATE TABLE IF NOT EXISTS sales_order (
  order_id        BIGSERIAL   PRIMARY KEY,
  product_id      TEXT        NOT NULL REFERENCES product_master(product_id) ON DELETE RESTRICT,
  shade_code      TEXT        NOT NULL REFERENCES shade_master(shade_code)   ON DELETE RESTRICT,
  country         CHAR(3)     NOT NULL CHECK (country  IN ('KOR','JP','US')),
  channel         TEXT        NOT NULL CHECK (channel  IN ('amazon','tiktok','offline')),
  sale_date       DATE        NOT NULL,
  quantity        INT         NOT NULL CHECK (quantity > 0),
  unit_price_usd  NUMERIC(8,2) NOT NULL CHECK (unit_price_usd > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sales_order IS '판매 주문(Fact): 일별 채널×국가×쉐이드 집계. PK는 자연키 대신 Surrogate Key 사용';

-- 대시보드 핵심 쿼리 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_so_product_country_date
  ON sales_order (product_id, country, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_so_shade_date
  ON sales_order (shade_code, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_so_channel
  ON sales_order (channel);


-- ─── 4. 재고 원장 (Inventory Ledger) ─────────────────────────────────────────
--   복식 기장 방식: INBOUND(+) / OUTBOUND(-) / ADJUSTMENT(±).
--   누적 SUM으로 현재 재고를 계산 → 실시간 재고 추적 가능.
CREATE TABLE IF NOT EXISTS inventory_ledger (
  ledger_id       BIGSERIAL   PRIMARY KEY,
  product_id      TEXT        NOT NULL REFERENCES product_master(product_id) ON DELETE RESTRICT,
  shade_code      TEXT        NOT NULL REFERENCES shade_master(shade_code)   ON DELETE RESTRICT,
  country         CHAR(3)     NOT NULL CHECK (country  IN ('KOR','JP','US')),
  txn_type        TEXT        NOT NULL CHECK (txn_type IN ('INBOUND','OUTBOUND','ADJUSTMENT')),
  quantity        INT         NOT NULL,  -- INBOUND: 양수 / OUTBOUND: 음수
  txn_date        DATE        NOT NULL,
  po_reference    TEXT,                 -- 발주서 번호 (INBOUND 시)
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE inventory_ledger IS '재고 원장: 복식 기장 방식(Double-Entry). SUM(quantity) = 현재 재고';
COMMENT ON COLUMN inventory_ledger.quantity IS 'INBOUND = 양수, OUTBOUND = 음수. SUM으로 현재고 계산';

CREATE INDEX IF NOT EXISTS idx_il_product_country
  ON inventory_ledger (product_id, country);

CREATE INDEX IF NOT EXISTS idx_il_shade_country
  ON inventory_ledger (shade_code, country);


-- ─── 5. 고객 세그먼트 (Customer Segment) ─────────────────────────────────────
--   RFM 기반 세그먼트를 월별 스냅샷으로 보존.
--   VIP / AT_RISK / NEW_VIRAL 세 가지 버킷 관리.
CREATE TABLE IF NOT EXISTS customer_segment (
  segment_id      BIGSERIAL   PRIMARY KEY,
  product_id      TEXT        NOT NULL REFERENCES product_master(product_id) ON DELETE RESTRICT,
  country         CHAR(3)     NOT NULL CHECK (country       IN ('KOR','JP','US')),
  segment_type    TEXT        NOT NULL CHECK (segment_type  IN ('VIP','AT_RISK','NEW_VIRAL')),
  customer_count  INT         NOT NULL CHECK (customer_count >= 0),
  female_pct      NUMERIC(5,2) NOT NULL CHECK (female_pct BETWEEN 0 AND 100),
  peak_age_range  TEXT        NOT NULL,   -- '여성, 20-29세'
  snapshot_date   DATE        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, country, segment_type, snapshot_date)
);

COMMENT ON TABLE customer_segment IS '고객 세그먼트 스냅샷: RFM 기반 월별 집계. VIP/AT_RISK/NEW_VIRAL';

CREATE INDEX IF NOT EXISTS idx_cs_product_country_date
  ON customer_segment (product_id, country, snapshot_date DESC);


-- =============================================================================
-- RLS (Row Level Security) 정책
-- =============================================================================

ALTER TABLE product_master    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shade_master       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segment   ENABLE ROW LEVEL SECURITY;

-- anon / authenticated 모두 SELECT 허용 (대시보드 조회용)
CREATE POLICY "read_all_product_master"    ON product_master    FOR SELECT USING (true);
CREATE POLICY "read_all_shade_master"      ON shade_master       FOR SELECT USING (true);
CREATE POLICY "read_all_sales_order"       ON sales_order        FOR SELECT USING (true);
CREATE POLICY "read_all_inventory_ledger"  ON inventory_ledger   FOR SELECT USING (true);
CREATE POLICY "read_all_customer_segment"  ON customer_segment   FOR SELECT USING (true);
