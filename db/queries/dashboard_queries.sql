-- =============================================================================
-- TIRTIR Cosmetics ERP — 대시보드 핵심 분석 쿼리
-- =============================================================================
-- 포트폴리오 하이라이트:
--   Query 1 — 30일 이동 평균 소진율     : 윈도우 함수 (ROWS BETWEEN)
--   Query 2 — RFM 고객 세분화 스코어    : CTE 다단계 체인
--   Query 3 — D-Day 재고 소진 예측      : CTE + 산술 계산
--   Query 4 — 악성 재고 자동 탐지       : 상관 서브쿼리 + EXISTS
--   Query 5 — 채널별 쉐이드 기여도 분석 : FILTER + RATIO_TO_REPORT 패턴
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- Query 1: 30일 이동 평균 소진율 (Rolling Burn Rate)
-- 기법: 윈도우 함수 AVG() OVER (ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)
-- 목적: 일별 판매 노이즈를 제거한 실질 소진 추세 파악
-- ─────────────────────────────────────────────────────────────────────────────
WITH daily_shade_sales AS (
  SELECT
    sale_date,
    shade_code,
    SUM(quantity)                AS daily_qty
  FROM sales_order
  WHERE product_id = 'red'
    AND country    IN ('KOR', 'JP', 'US')
  GROUP BY sale_date, shade_code
),

rolling_burn AS (
  SELECT
    sale_date,
    shade_code,
    daily_qty,
    -- ★ 윈도우 함수: 직전 29일 + 당일 = 30일 이동 평균
    ROUND(
      AVG(daily_qty) OVER (
        PARTITION BY shade_code
        ORDER BY sale_date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
      ), 1
    )                            AS rolling_avg_30d,
    -- 추가: 7일 이동 평균 (단기 트렌드)
    ROUND(
      AVG(daily_qty) OVER (
        PARTITION BY shade_code
        ORDER BY sale_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
      ), 1
    )                            AS rolling_avg_7d
  FROM daily_shade_sales
)

SELECT
  sale_date,
  shade_code,
  daily_qty                      AS "당일 판매량",
  rolling_avg_7d                 AS "7일 이동평균",
  rolling_avg_30d                AS "30일 이동평균 (Burn Rate)",
  -- 추세 방향: 단기가 장기보다 높으면 상승 추세
  CASE
    WHEN rolling_avg_7d > rolling_avg_30d THEN '↑ 상승'
    WHEN rolling_avg_7d < rolling_avg_30d THEN '↓ 하락'
    ELSE '→ 보합'
  END                            AS "소진 추세"
FROM rolling_burn
WHERE sale_date >= CURRENT_DATE - 7     -- 최근 7일 조회
ORDER BY shade_code, sale_date;


-- ─────────────────────────────────────────────────────────────────────────────
-- Query 2: RFM 고객 세분화 스코어
-- 기법: CTE 3단 체인 (구매빈도 → 구매금액 → RFM 스코어 → 세그먼트 분류)
-- 목적: 고객을 VIP / 일반 / 이탈 위험으로 자동 분류
--
-- ※ sales_order에 customer_id 컬럼이 있다고 가정한 분석 쿼리
--   (현재 스키마는 집계 단위. 실제 연동 시 customer_id FK 추가)
-- ─────────────────────────────────────────────────────────────────────────────
WITH customer_txns AS (
  -- Recency: 마지막 구매일, Frequency: 구매 횟수, Monetary: 총 구매액
  SELECT
    country,
    shade_code,
    COUNT(*)                                   AS frequency,
    SUM(quantity * unit_price_usd)             AS monetary_usd,
    MAX(sale_date)                             AS last_purchase_date,
    CURRENT_DATE - MAX(sale_date)              AS recency_days
  FROM sales_order
  WHERE product_id = 'red'
  GROUP BY country, shade_code
),

rfm_scores AS (
  SELECT
    country,
    shade_code,
    recency_days,
    frequency,
    ROUND(monetary_usd, 2)                    AS monetary_usd,
    -- R 스코어: 최근일수록 높음 (5분위)
    NTILE(5) OVER (ORDER BY recency_days ASC)  AS r_score,
    -- F 스코어: 빈도 높을수록 높음 (5분위)
    NTILE(5) OVER (ORDER BY frequency DESC)    AS f_score,
    -- M 스코어: 금액 높을수록 높음 (5분위)
    NTILE(5) OVER (ORDER BY monetary_usd DESC) AS m_score
  FROM customer_txns
),

rfm_classified AS (
  SELECT
    *,
    r_score + f_score + m_score               AS rfm_total,
    CASE
      WHEN r_score >= 4 AND f_score >= 4             THEN 'VIP'
      WHEN r_score <= 2 AND f_score >= 3             THEN 'AT_RISK'
      WHEN r_score >= 4 AND f_score <= 2             THEN 'NEW_VIRAL'
      ELSE                                                 'REGULAR'
    END                                        AS segment
  FROM rfm_scores
)

SELECT
  country                        AS "국가",
  segment                        AS "세그먼트",
  COUNT(*)                       AS "쉐이드 수",
  ROUND(AVG(rfm_total), 1)      AS "평균 RFM 점수",
  ROUND(AVG(monetary_usd), 0)   AS "평균 구매액 (USD)",
  ROUND(AVG(recency_days), 0)   AS "평균 마지막 구매(일)"
FROM rfm_classified
GROUP BY country, segment
ORDER BY country, rfm_total DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- Query 3: D-Day 재고 소진 예측
-- 기법: CTE 조인 + 산술 계산 (stock / burn_rate = 예상 소진일)
-- 목적: 발주 의사결정 지원 (14일 이내 = 긴급 발주)
-- ─────────────────────────────────────────────────────────────────────────────
WITH current_inventory AS (
  -- 복식 기장 재고 원장에서 현재 재고 계산
  SELECT
    product_id,
    shade_code,
    country,
    SUM(quantity)            AS net_stock    -- INBOUND(+) + OUTBOUND(-) 누적
  FROM inventory_ledger
  WHERE product_id = 'red'
    AND country    IN ('KOR', 'JP', 'US')
  GROUP BY product_id, shade_code, country
  HAVING SUM(quantity) > 0
),

avg_daily_burn AS (
  -- 최근 30일 일평균 소진율
  SELECT
    product_id,
    shade_code,
    country,
    GREATEST(1,
      ROUND(SUM(quantity) / 30.0)
    )                        AS daily_burn
  FROM sales_order
  WHERE product_id = 'red'
    AND country    IN ('KOR', 'JP', 'US')
    AND sale_date  >= CURRENT_DATE - 30
  GROUP BY product_id, shade_code, country
),

stockout_forecast AS (
  SELECT
    ci.product_id,
    ci.shade_code,
    sm.shade_name,
    ci.country,
    ci.net_stock,
    COALESCE(ab.daily_burn, 1)                        AS daily_burn,
    -- D-Day: 현재 재고 ÷ 일평균 소진율
    ROUND(ci.net_stock::NUMERIC
          / NULLIF(COALESCE(ab.daily_burn, 1), 0))::INT  AS d_day,
    -- 예상 소진일
    CURRENT_DATE
      + ROUND(ci.net_stock::NUMERIC
              / NULLIF(COALESCE(ab.daily_burn, 1), 0))::INT  AS est_stockout_date
  FROM current_inventory ci
  JOIN shade_master       sm ON sm.shade_code = ci.shade_code
  LEFT JOIN avg_daily_burn ab
         ON ab.shade_code = ci.shade_code AND ab.country = ci.country
)

SELECT
  shade_code                     AS "쉐이드",
  shade_name                     AS "색상명",
  country                        AS "국가",
  net_stock                      AS "현재 재고",
  daily_burn                     AS "일 소진율",
  d_day                          AS "D-Day",
  est_stockout_date              AS "예상 소진일",
  CASE
    WHEN d_day <= 14  THEN '🚨 긴급 발주 필요'
    WHEN d_day <= 30  THEN '⚠️  발주 검토'
    ELSE                   '✅  재고 양호'
  END                            AS "발주 상태"
FROM stockout_forecast
ORDER BY d_day ASC;


-- ─────────────────────────────────────────────────────────────────────────────
-- Query 4: 악성 재고 자동 탐지
-- 기법: NOT EXISTS (상관 서브쿼리) — 판매 이력 없는 쉐이드 탐지
-- 목적: 90일 이상 미판매 재고 → 손실 추정 및 할인 프로모션 타깃
-- ─────────────────────────────────────────────────────────────────────────────
WITH stagnant_shades AS (
  SELECT
    il.product_id,
    il.shade_code,
    il.country,
    SUM(il.quantity)                        AS net_stock,
    -- 상관 서브쿼리: 해당 쉐이드의 마지막 판매일
    (
      SELECT MAX(so.sale_date)
      FROM   sales_order so
      WHERE  so.product_id = il.product_id
        AND  so.shade_code = il.shade_code
        AND  so.country    = il.country
    )                                        AS last_sale_date,
    CURRENT_DATE - (
      SELECT MAX(so.sale_date)
      FROM   sales_order so
      WHERE  so.product_id = il.product_id
        AND  so.shade_code = il.shade_code
        AND  so.country    = il.country
    )                                        AS days_stagnant
  FROM inventory_ledger il
  WHERE il.product_id = 'red'
    AND il.country    IN ('KOR', 'JP', 'US')
  GROUP BY il.product_id, il.shade_code, il.country
  HAVING SUM(il.quantity) > 0
    -- 조건: 재고가 있으나 90일간 판매 실적 없음 (NOT EXISTS 활용)
    AND NOT EXISTS (
      SELECT 1
      FROM   sales_order so
      WHERE  so.product_id = il.product_id
        AND  so.shade_code = il.shade_code
        AND  so.country    = il.country
        AND  so.sale_date  >= CURRENT_DATE - 90
    )
)

SELECT
  shade_code                      AS "쉐이드",
  sm.shade_name                   AS "색상명",
  sm.depth_class                  AS "명도 클래스",
  country                         AS "국가",
  net_stock                       AS "잔여 재고",
  last_sale_date                  AS "마지막 판매일",
  days_stagnant                   AS "미판매 경과일",
  ROUND(days_stagnant / 30.0, 1) AS "미판매 경과 (월)",
  -- 손실 추정: 재고 × 원가(단가의 60%) × 환율
  ROUND(net_stock * 12.0 * 0.6 * 1350)::BIGINT  AS "손실 추정 (KRW)"
FROM stagnant_shades ss
JOIN shade_master sm ON sm.shade_code = ss.shade_code
ORDER BY days_stagnant DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- Query 5: 채널별 쉐이드 기여도 분석 (Revenue Attribution)
-- 기법: FILTER 조건부 집계 + 비율 계산 (RATIO_TO_REPORT 패턴)
-- 목적: 어느 채널에서 어떤 쉐이드가 매출을 견인하는지 파악
-- ─────────────────────────────────────────────────────────────────────────────
WITH shade_channel_revenue AS (
  SELECT
    shade_code,
    sm.shade_name,
    sm.undertone,
    sm.depth_class,
    -- FILTER 절로 채널별 분리 집계 (CASE WHEN SUM 대비 간결)
    SUM(quantity * unit_price_usd)
      FILTER (WHERE channel = 'amazon')   AS amazon_revenue,
    SUM(quantity * unit_price_usd)
      FILTER (WHERE channel = 'tiktok')   AS tiktok_revenue,
    SUM(quantity * unit_price_usd)
      FILTER (WHERE channel = 'offline')  AS offline_revenue,
    SUM(quantity * unit_price_usd)        AS total_revenue
  FROM sales_order so
  JOIN shade_master sm USING (shade_code)
  WHERE so.product_id = 'red'
    AND so.country    IN ('KOR', 'JP', 'US')
    AND so.sale_date  >= CURRENT_DATE - 28
  GROUP BY shade_code, sm.shade_name, sm.undertone, sm.depth_class
),

with_ratio AS (
  SELECT
    *,
    -- 전체 매출 대비 쉐이드 기여율 (RATIO_TO_REPORT 패턴)
    ROUND(
      total_revenue * 100.0
      / NULLIF(SUM(total_revenue) OVER (), 0)
    , 2)                                  AS revenue_share_pct,
    -- 채널 중 주력 채널 판별
    CASE
      WHEN GREATEST(amazon_revenue, tiktok_revenue, offline_revenue)
           = amazon_revenue  THEN '아마존'
      WHEN GREATEST(amazon_revenue, tiktok_revenue, offline_revenue)
           = tiktok_revenue  THEN '틱톡샵'
      ELSE                        '오프라인'
    END                                   AS dominant_channel
  FROM shade_channel_revenue
)

SELECT
  shade_code                      AS "쉐이드",
  shade_name                      AS "색상명",
  undertone                       AS "언더톤",
  depth_class                     AS "명도",
  ROUND(amazon_revenue,  0)       AS "아마존 매출 (USD)",
  ROUND(tiktok_revenue,  0)       AS "틱톡샵 매출 (USD)",
  ROUND(offline_revenue, 0)       AS "오프라인 매출 (USD)",
  ROUND(total_revenue,   0)       AS "합계 매출 (USD)",
  revenue_share_pct               AS "전체 기여율 (%)",
  dominant_channel                AS "주력 채널"
FROM with_ratio
ORDER BY total_revenue DESC
LIMIT 20;
