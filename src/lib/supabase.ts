/**
 * Supabase 클라이언트 — Native Fetch 기반 PostgREST 래퍼
 * =========================================================
 * @supabase/supabase-js SDK 없이 브라우저 fetch API만으로 구현.
 * Supabase PostgREST 프로토콜:
 *   - RPC 호출: POST /rest/v1/rpc/{function_name}
 *   - 인증:     apikey / Authorization 헤더
 *
 * 환경 변수 (Vite):
 *   VITE_SUPABASE_URL      = https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY = eyJ...  (anon/public key)
 */

import type { CountryMetrics } from '../mockData';

/** 채널 오버라이드 타입 (채널 선택 시 RPC 집계를 대체) */
export interface ChannelOverrides {
  shadeIntensity: Record<string, number>;
  femalePct:      number;
  ageGroup:       string;
  vipCount:       number;
  atRiskCount:    number;
  newViralCount:  number;
}

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase 연결 가능 여부 (env vars 설정 시 true) */
export const isSupabaseConfigured: boolean =
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ─── PostgREST RPC 호출 헬퍼 ─────────────────────────────────────────────────
async function rpc<T>(
  functionName: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/${functionName}`,
    {
      method: 'POST',
      signal,
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY!}`,
      },
      body: JSON.stringify(params),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[Supabase RPC] ${functionName} → HTTP ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── RPC 응답 타입 (003_rpc_functions.sql의 JSONB 키와 1:1 매핑) ─────────────
interface DashboardRpcResult {
  total_sales_k:   number;
  mom_growth:      number;
  mom_target:      number;
  velocity:        Array<{ day: string; amazon: number; tiktok: number; offline: number }>;
  shade_intensity: Record<string, number>;
  inventory:       Array<{ shade: string; code: string; stock: number; burnRate: number }>;
  dead_stock:      Array<{ shade: string; months: number; lossKRW: number }>;
  female_pct:      number;
  age_group:       string;
  vip_count:       number;
  at_risk_count:   number;
  new_viral_count: number;
  action_shade:    string;
  action_market:   string;
  action_target:   number;
  action_roi:      string;
}

/**
 * get_dashboard_metrics RPC 호출 → CountryMetrics 타입으로 변환
 *
 * SQL 함수 하나로 대시보드 전체 지표를 반환 (N+1 쿼리 방지).
 * 실패 시 null 반환 → 호출부에서 mock fallback 처리.
 */
export async function fetchDashboardMetrics(
  productId: string,
  countries: string[],
  signal?: AbortSignal,
): Promise<CountryMetrics | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const raw = await rpc<DashboardRpcResult>(
      'get_dashboard_metrics',
      { p_product_id: productId, p_countries: countries },
      signal,
    );

    // snake_case (DB) → camelCase (TS) 변환
    return {
      totalSalesK:   raw.total_sales_k  ?? 0,
      momGrowth:     raw.mom_growth     ?? 0,
      momTarget:     raw.mom_target     ?? 12,
      velocity:      raw.velocity       ?? [],
      shadeIntensity: raw.shade_intensity ?? {},
      inventory:     raw.inventory      ?? [],
      deadStock:     (raw.dead_stock ?? []).map(d => ({
        shade:   d.shade,
        months:  d.months,
        lossKRW: d.lossKRW,
      })),
      femalePct:     raw.female_pct     ?? 85,
      ageGroup:      raw.age_group      ?? '여성, 20-29세',
      vipCount:      raw.vip_count      ?? 0,
      atRiskCount:   raw.at_risk_count  ?? 0,
      newViralCount: raw.new_viral_count ?? 0,
      actionShade:   raw.action_shade   ?? '',
      actionMarket:  raw.action_market  ?? '',
      actionTarget:  raw.action_target  ?? 0,
      actionRoi:     raw.action_roi     ?? '3.0x',
    };

  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;   // 취소는 그대로 전파
    console.warn('[Supabase] fetchDashboardMetrics 실패 → mock fallback:', err);
    return null;
  }
}

// ─── 채널 오버라이드: 채널 선택 시 shade intensity & 고객 세그먼트를 직접 집계 ──

/** PostgREST 직접 쿼리 헬퍼 */
async function pgrest<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    signal,
    headers: {
      'apikey':        SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY!}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[Supabase REST] ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * 채널 선택 시 채널별 shade intensity + 고객 세그먼트를 직접 조회.
 * RPC가 채널 파라미터를 지원하지 않으므로 REST API로 직접 집계.
 *
 * customer_segment는 peak_age_range = "channel|연령대" 인코딩 방식으로 저장.
 */
export async function fetchChannelOverrides(
  productId: string,
  country:   string,
  channel:   string,   // 'amazon' | 'tiktok' | 'offline'
  signal?:   AbortSignal,
): Promise<ChannelOverrides | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // ① 채널별 쉐이드 강도 (최근 28일 sales_order 직접 집계)
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    const shadeRows = await pgrest<Array<{ shade_code: string; quantity: number }>>(
      `sales_order?select=shade_code,quantity`
      + `&product_id=eq.${productId}`
      + `&country=eq.${country}`
      + `&channel=eq.${channel}`
      + `&sale_date=gte.${since}`,
      signal,
    );

    const agg: Record<string, number> = {};
    shadeRows.forEach(r => { agg[r.shade_code] = (agg[r.shade_code] ?? 0) + r.quantity; });
    const maxQty = Math.max(...Object.values(agg), 1);
    const shadeIntensity: Record<string, number> = Object.fromEntries(
      Object.entries(agg).map(([k, v]) => [k, Math.max(5, Math.round(v * 100 / maxQty))]),
    );

    // ② 채널별 고객 세그먼트 (peak_age_range = "channel|연령대" 인코딩)
    // encodeURIComponent('|') = %7C
    const segRows = await pgrest<Array<{
      segment_type:   string;
      customer_count: number;
      female_pct:     number;
      peak_age_range: string;
    }>>(
      `customer_segment?select=segment_type,customer_count,female_pct,peak_age_range`
      + `&product_id=eq.${productId}`
      + `&country=eq.${country}`
      + `&peak_age_range=like.${encodeURIComponent(channel + '|')}*`
      + `&order=snapshot_date.desc`,
      signal,
    );

    // 세그먼트 타입별 최신 1건씩
    const byType: Record<string, typeof segRows[0]> = {};
    segRows.forEach(r => { if (!byType[r.segment_type]) byType[r.segment_type] = r; });

    const vip      = byType['VIP'];
    const atRisk   = byType['AT_RISK'];
    const newViral = byType['NEW_VIRAL'];
    const anyRow   = vip ?? atRisk ?? newViral;

    return {
      shadeIntensity,
      femalePct:     anyRow ? Math.round(Number(anyRow.female_pct)) : 85,
      // "channel|연령대" → 연령대 파싱
      ageGroup:      anyRow ? (anyRow.peak_age_range.split('|')[1] ?? '여성, 20-29세') : '여성, 20-29세',
      vipCount:      vip      ? vip.customer_count      : 0,
      atRiskCount:   atRisk   ? atRisk.customer_count   : 0,
      newViralCount: newViral ? newViral.customer_count : 0,
    };

  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    console.warn('[Supabase] fetchChannelOverrides 실패:', err);
    return null;
  }
}
