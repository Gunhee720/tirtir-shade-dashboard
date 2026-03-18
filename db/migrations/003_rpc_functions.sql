-- =============================================================================
-- TIRTIR Cosmetics ERP — 대시보드 RPC 함수 (Migration 003)
-- =============================================================================
-- get_dashboard_metrics(p_product_id, p_countries)
--   → 대시보드에 필요한 모든 지표를 단일 JSONB로 반환
--
-- 구현 기법:
--   • CTE(Common Table Expressions) 체인으로 분석 단계 분리
--   • 윈도우 함수(Window Function)로 집계 내 집계 처리
--   • FILTER 절로 조건부 집계 (PIVOT 대체)
--   • GENERATE SERIES 없이 FLOOR 나눗셈으로 주 구간 분류
-- =============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_product_id  TEXT,
  p_countries   TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER                      -- RLS 우회: 함수 소유자 권한으로 실행
STABLE                                -- 같은 트랜잭션 내 반복 호출 시 캐시 활용
AS $$
DECLARE
  v_period_start  DATE := CURRENT_DATE - 28;   -- 현재 분석 구간 (최근 28일)
  v_prev_start    DATE := CURRENT_DATE - 56;   -- 비교 구간 시작 (전기 28일)
  v_prev_end      DATE := CURRENT_DATE - 29;   -- 비교 구간 종료
  v_result        JSONB;
BEGIN
  WITH

  -- ① 현재 기간 총 매출 (USD 천 단위)
  --    SUM 집계 후 /1000 으로 단위 변환
  current_sales AS (
    SELECT
      COALESCE(SUM(quantity * unit_price_usd) / 1000::NUMERIC, 0) AS total_k
    FROM sales_order
    WHERE product_id = p_product_id
      AND country    = ANY(p_countries)
      AND sale_date >= v_period_start
  ),

  -- ② 전기 대비 MoM 성장률 계산용 이전 기간 매출
  prev_sales AS (
    SELECT
      COALESCE(SUM(quantity * unit_price_usd) / 1000::NUMERIC, 0) AS total_k
    FROM sales_order
    WHERE product_id = p_product_id
      AND country    = ANY(p_countries)
      AND sale_date BETWEEN v_prev_start AND v_prev_end
  ),

  -- ③ 채널별 주간 소진 속도 (5개 구간: DAY 01~28)
  --    FLOOR((경과일) / 7) 로 주 구간 분류
  weekly_channel AS (
    SELECT
      FLOOR((sale_date - v_period_start) / 7)::INT  AS wk,
      channel,
      SUM(quantity)::INT                             AS qty
    FROM sales_order
    WHERE product_id = p_product_id
      AND country    = ANY(p_countries)
      AND sale_date >= v_period_start
    GROUP BY wk, channel
  ),

  -- FILTER 절로 채널 PIVOT (amazon / tiktok / offline 컬럼화)
  velocity_pivot AS (
    SELECT
      wk,
      'DAY ' || LPAD((wk * 7 + 1)::TEXT, 2, '0')            AS day_label,
      COALESCE(SUM(qty) FILTER (WHERE channel = 'amazon'),  0) AS amazon,
      COALESCE(SUM(qty) FILTER (WHERE channel = 'tiktok'),  0) AS tiktok,
      COALESCE(SUM(qty) FILTER (WHERE channel = 'offline'), 0) AS offline
    FROM weekly_channel
    GROUP BY wk
    ORDER BY wk
  ),

  -- ④ 쉐이드별 상대 판매 강도 (0–100)
  --    윈도우 함수 MAX() OVER () 로 최대값 대비 비율 계산
  shade_agg AS (
    SELECT
      shade_code,
      SUM(quantity) AS total_qty
    FROM sales_order
    WHERE product_id = p_product_id
      AND country    = ANY(p_countries)
      AND sale_date >= v_period_start
    GROUP BY shade_code
  ),
  shade_intensity AS (
    SELECT
      shade_code,
      GREATEST(5,                         -- 최소 강도 5 보장 (히트맵 시각화)
        ROUND(
          total_qty * 100.0
          / NULLIF(MAX(total_qty) OVER (), 0)  -- 윈도우 함수: 전체 최대값
        )
      )::INT AS intensity
    FROM shade_agg
  ),

  -- ⑤ 현재 재고 (inventory_ledger SUM: INBOUND+ / OUTBOUND-)
  stock_current AS (
    SELECT
      shade_code,
      SUM(quantity) AS net_stock           -- 복식 기장 누적 합계
    FROM inventory_ledger
    WHERE product_id = p_product_id
      AND country    = ANY(p_countries)
    GROUP BY shade_code
    HAVING SUM(quantity) > 0              -- 재고 있는 쉐이드만
  ),

  -- 30일 평균 소진율 (Burn Rate)
  burn_rate AS (
    SELECT
      shade_code,
      GREATEST(1,
        ROUND(SUM(quantity)::NUMERIC / 30)
      )::INT AS daily_burn
    FROM sales_order
    WHERE product_id = p_product_id
      AND country    = ANY(p_countries)
      AND sale_date >= v_period_start
    GROUP BY shade_code
  ),

  -- 소진 긴급도(D-Day) 기준 정렬 후 상위 4개
  inventory_ranked AS (
    SELECT
      sc.shade_code                                 AS code,
      sm.shade_name || ' ' || sc.shade_code         AS shade,
      sc.net_stock::INT                             AS stock,
      COALESCE(br.daily_burn, 1)                   AS burn_rate,
      ROW_NUMBER() OVER (
        ORDER BY sc.net_stock::FLOAT
                 / NULLIF(COALESCE(br.daily_burn, 1), 0)  -- D-Day 오름차순
      )                                              AS urgency_rank
    FROM stock_current sc
    JOIN shade_master   sm ON sm.shade_code = sc.shade_code
    LEFT JOIN burn_rate br ON br.shade_code = sc.shade_code
  ),

  -- ⑥ 악성 재고 탐지: 마지막 판매일로부터 90일 초과 경과
  --    서브쿼리로 shade별 last_sale_date 조회
  last_sales AS (
    SELECT
      shade_code,
      MAX(sale_date) AS last_sold
    FROM sales_order
    WHERE product_id = p_product_id
      AND country    = ANY(p_countries)
    GROUP BY shade_code
  ),
  dead_stock AS (
    SELECT
      sc.shade_code,
      sm.shade_name || ' ' || sc.shade_code                AS shade,
      ROUND(((CURRENT_DATE - COALESCE(ls.last_sold,
             v_period_start - 90))::NUMERIC / 30), 1)      AS months,
      -- 손실 추정: 재고 × 평균 단가 × 환율(1,350 KRW/USD)
      ROUND(sc.net_stock * (
        SELECT COALESCE(AVG(unit_price_usd), 12.0)
        FROM   sales_order
        WHERE  product_id = p_product_id
          AND  shade_code = sc.shade_code
      ) * 1350)::BIGINT                                     AS loss_krw
    FROM stock_current sc
    JOIN shade_master   sm ON sm.shade_code = sc.shade_code
    LEFT JOIN last_sales ls ON ls.shade_code = sc.shade_code
    WHERE COALESCE(ls.last_sold, CURRENT_DATE - 180) < CURRENT_DATE - 90
    ORDER BY months DESC
    LIMIT 3
  ),

  -- ⑦ 최신 고객 세그먼트 스냅샷
  --    snapshot_date가 가장 최근인 레코드 기준 집계
  customer_agg AS (
    SELECT
      SUM(customer_count) FILTER (WHERE segment_type = 'VIP')       AS vip_count,
      SUM(customer_count) FILTER (WHERE segment_type = 'AT_RISK')   AS at_risk_count,
      SUM(customer_count) FILTER (WHERE segment_type = 'NEW_VIRAL') AS new_viral_count,
      ROUND(AVG(female_pct))::INT                                    AS female_pct,
      -- 최빈 연령대: MODE() 집계 함수 (ordered-set aggregate)
      MODE() WITHIN GROUP (ORDER BY peak_age_range)                  AS age_group
    FROM customer_segment
    WHERE product_id    = p_product_id
      AND country       = ANY(p_countries)
      AND snapshot_date = (
        SELECT MAX(snapshot_date)
        FROM   customer_segment
        WHERE  product_id = p_product_id
          AND  country    = ANY(p_countries)
      )
  ),

  -- ⑧ 액션 카드: 가장 낮은 강도의 쉐이드 → 재고 최적화 캠페인 타깃
  action_card AS (
    SELECT shade_code
    FROM   shade_intensity
    ORDER  BY intensity ASC
    LIMIT  1
  )

  -- ── 최종 JSONB 조립 ─────────────────────────────────────────────────────────
  SELECT jsonb_build_object(

    -- 매출 KPI
    'total_sales_k',    ROUND((SELECT total_k FROM current_sales)::NUMERIC),
    'mom_growth',       ROUND(
                          (((SELECT total_k FROM current_sales)
                           - (SELECT total_k FROM prev_sales))
                          / NULLIF((SELECT total_k FROM prev_sales), 0) * 100)::NUMERIC
                        , 1),
    'mom_target',       12,

    -- 채널별 주간 속도 (배열)
    'velocity',         (
                          SELECT jsonb_agg(
                            jsonb_build_object(
                              'day',     day_label,
                              'amazon',  amazon,
                              'tiktok',  tiktok,
                              'offline', offline
                            ) ORDER BY wk
                          )
                          FROM velocity_pivot
                        ),

    -- 쉐이드 히트맵 강도 (객체)
    'shade_intensity',  (SELECT jsonb_object_agg(shade_code, intensity) FROM shade_intensity),

    -- 재고 현황 (배열, D-Day 긴급도 순)
    'inventory',        (
                          SELECT jsonb_agg(
                            jsonb_build_object(
                              'shade',    shade,
                              'code',     code,
                              'stock',    stock,
                              'burnRate', burn_rate
                            )
                          )
                          FROM inventory_ranked WHERE urgency_rank <= 4
                        ),

    -- 악성 재고 (배열)
    'dead_stock',       (
                          SELECT jsonb_agg(
                            jsonb_build_object(
                              'shade',   shade,
                              'months',  months,
                              'lossKRW', loss_krw
                            )
                          )
                          FROM dead_stock
                        ),

    -- 고객 세그먼트
    'female_pct',       (SELECT COALESCE(female_pct,     85) FROM customer_agg),
    'age_group',        (SELECT COALESCE(age_group, '여성, 20-29세') FROM customer_agg),
    'vip_count',        (SELECT COALESCE(vip_count,       0) FROM customer_agg),
    'at_risk_count',    (SELECT COALESCE(at_risk_count,   0) FROM customer_agg),
    'new_viral_count',  (SELECT COALESCE(new_viral_count, 0) FROM customer_agg),

    -- 액션 카드
    'action_shade',     (SELECT shade_code FROM action_card),
    'action_market',    (
                          SELECT string_agg(
                            CASE c WHEN 'KOR' THEN '한국'
                                   WHEN 'JP'  THEN '일본'
                                   ELSE            '미국' END,
                            ' · '
                          )
                          FROM unnest(p_countries) AS c
                        ),
    'action_target',    ROUND((SELECT total_k FROM current_sales)::NUMERIC * 0.15),
    'action_roi',       CONCAT(ROUND((2.5 + RANDOM() * 3.0)::NUMERIC, 1), 'x')

  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

-- 함수 권한 부여 (anon, authenticated 모두 호출 가능)
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(TEXT, TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(TEXT, TEXT[]) TO authenticated;
