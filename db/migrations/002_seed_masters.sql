-- =============================================================================
-- TIRTIR Cosmetics ERP — 마스터 데이터 시드 (Migration 002)
-- =============================================================================
-- product_master: 4개 쿠션 제품
-- shade_master:   46개 쉐이드 (숫자 명도 + C/N/W 언더톤 체계)
-- =============================================================================


-- ─── 1. product_master 시드 ───────────────────────────────────────────────────

INSERT INTO product_master (product_id, product_name, product_line, sku_code, launch_date, base_price_usd)
VALUES
  ('red',     '마스크핏 레드 쿠션',         'Mask Fit', 'RD-CSN-01', '2021-03-15', 12.00),
  ('ai',      '마스크핏 AI 필터 쿠션',       'Mask Fit', 'AI-CSN-01', '2022-09-01', 14.00),
  ('ruby',    '마스크핏 루비 메쉬 쿠션',     'Mask Fit', 'RB-CSN-01', '2023-03-10', 13.00),
  ('crystal', '마스크핏 크리스탈 메쉬 쿠션', 'Mask Fit', 'CR-CSN-01', '2023-09-20', 13.50)
ON CONFLICT (product_id) DO NOTHING;


-- ─── 2. shade_master 시드 ─────────────────────────────────────────────────────
-- shade_code 형식: {숫자}{언더톤}   예) '17C' = 명도17, Cool 언더톤
-- depth_class는 GENERATED ALWAYS 컬럼이므로 삽입 불필요

INSERT INTO shade_master (shade_code, shade_name, undertone, shade_number)
VALUES
  -- ── Very Light (≤15) ──────────────────────────────────────────────────────
  ('10C',   'Porcelain',   'C', 10.0),
  ('13C',   'Ivory',       'C', 13.0),
  ('13N',   'Ivory',       'N', 13.0),
  ('13W',   'Ivory',       'W', 13.0),
  ('13.5N', 'Soft Ivory',  'N', 13.5),
  ('15C',   'Fair',        'C', 15.0),
  ('15.5N', 'Fair Natural','N', 15.5),

  -- ── Light (16–21) ─────────────────────────────────────────────────────────
  ('17C',   'Light',       'C', 17.0),
  ('17N',   'Light',       'N', 17.0),
  ('17W',   'Light Warm',  'W', 17.0),
  ('19C',   'Nude',        'C', 19.0),
  ('19N',   'Nude',        'N', 19.0),
  ('19.5N', 'Soft Nude',   'N', 19.5),
  ('21C',   'Natural',     'C', 21.0),
  ('21N',   'Natural',     'N', 21.0),
  ('21W',   'Natural Warm','W', 21.0),

  -- ── Medium (22–27) ────────────────────────────────────────────────────────
  ('22C',   'Beige',       'C', 22.0),
  ('22N',   'Beige',       'N', 22.0),
  ('22W',   'Beige Warm',  'W', 22.0),
  ('23N',   'Sand',        'N', 23.0),
  ('24N',   'Sand',        'N', 24.0),
  ('24W',   'Sand Warm',   'W', 24.0),
  ('25N',   'Medium',      'N', 25.0),
  ('27C',   'Warm',        'C', 27.0),
  ('27N',   'Warm',        'N', 27.0),

  -- ── Medium Dark (28–35) ───────────────────────────────────────────────────
  ('28N',   'Golden',      'N', 28.0),
  ('29C',   'Caramel',     'C', 29.0),
  ('29N',   'Caramel',     'N', 29.0),
  ('30N',   'Honey',       'N', 30.0),
  ('31N',   'Honey',       'N', 31.0),
  ('33C',   'Tan',         'C', 33.0),
  ('33N',   'Tan',         'N', 33.0),
  ('33W',   'Tan Warm',    'W', 33.0),
  ('34C',   'Deep',        'C', 34.0),
  ('34N',   'Deep',        'N', 34.0),
  ('34W',   'Deep Warm',   'W', 34.0),
  ('35N',   'Toffee',      'N', 35.0),

  -- ── Dark (>35) ────────────────────────────────────────────────────────────
  ('37C',   'Espresso',    'C', 37.0),
  ('40N',   'Chestnut',    'N', 40.0),
  ('43N',   'Mahogany',    'N', 43.0),
  ('45N',   'Ebony',       'N', 45.0),
  ('45W',   'Ebony Warm',  'W', 45.0),
  ('47N',   'Onyx',        'N', 47.0),
  ('51N',   'Midnight',    'N', 51.0),
  ('55N',   'Obsidian',    'N', 55.0)
ON CONFLICT (shade_code) DO NOTHING;
