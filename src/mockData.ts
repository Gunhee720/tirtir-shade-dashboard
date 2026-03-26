// ── Types ──────────────────────────────────────────────────────────────────────
export interface VelocityPoint {
  day: string;
  amazon: number;
  tiktok: number;
  offline: number;
}

export interface InventoryRow {
  shade: string;    // display name e.g. "17C Light"
  code: string;     // shade code e.g. "17C"
  stock: number;
  burnRate: number; // total units/day across all channels
}

export interface DeadStockRow {
  shade: string;
  months: number;
  lossKRW: number;
}

export interface CountryMetrics {
  totalSalesK: number;   // USD thousands
  momGrowth: number;     // %
  momTarget: number;     // planning target %
  velocity: VelocityPoint[];
  shadeIntensity: Record<string, number>; // shadeName → raw 0-100
  inventory: InventoryRow[];
  deadStock: DeadStockRow[];
  femalePct: number;
  ageGroup: string;
  vipCount: number;
  atRiskCount: number;
  newViralCount: number;
  actionShade: string;
  actionMarket: string;
  actionTarget: number;
  actionRoi: string;
}

// ── Snap raw intensity to valid CSS bucket ─────────────────────────────────────
export function snapIntensity(v: number): number {
  const BUCKETS = [5, 20, 40, 70, 100];
  return BUCKETS.reduce((prev, curr) =>
    Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
  );
}

// ── Per-product shade modifier ─────────────────────────────────────────────────
export function applyProductMod(productId: string, shadeName: string, intensity: number): number {
  const num = parseFloat(shadeName);
  switch (productId) {
    case 'ai':     // AI Filter: Cool(C) tones amplified
      return shadeName.includes('C') ? Math.min(100, intensity * 1.3) : intensity * 0.85;
    case 'ruby':   // Ruby Mesh: Warm(W)/Neutral(N) amplified
      return (shadeName.includes('W') || shadeName.includes('N'))
        ? Math.min(100, intensity * 1.15) : intensity * 0.85;
    case 'crystal': // Crystal Mesh: Light shades (≤21) amplified
      return num <= 21 ? Math.min(100, intensity * 1.35) : intensity * 0.65;
    default:       // Red: no modification
      return intensity;
  }
}

// ── Base shade intensity per country ──────────────────────────────────────────
// KOR = light/mid shades strong, JP = very light dominant, US = medium-dark strong
const KOR_SHADE: Record<string, number> = {
  '10C': 20, '13C': 40, '13N': 70, '13W': 20, '13.5N': 30,
  '15C': 90, '15.5N': 40, '17C': 100, '17N': 60, '17W': 20,
  '19C': 50, '19N': 20, '19.5N': 30, '21C': 20, '21N': 100,
  '21W': 70, '22C': 10, '22N': 40, '22W': 10, '23N': 100,
  '24N': 50, '24W': 30, '25N': 70, '27C': 10, '27N': 30,
  '28N': 40, '29C': 5,  '29N': 60, '30N': 20, '31N': 20,
  '33C': 5,  '33N': 30, '33W': 5,  '34C': 5,  '34N': 5,
  '34W': 5,  '35N': 20, '37C': 5,  '40N': 10, '43N': 20,
  '45N': 5,  '45W': 5,  '47N': 5,  '51N': 5,  '55N': 5,
};
const JP_SHADE: Record<string, number> = {
  '10C': 40, '13C': 90, '13N': 100,'13W': 30, '13.5N': 60,
  '15C': 100,'15.5N': 70,'17C': 100,'17N': 50, '17W': 20,
  '19C': 40, '19N': 20, '19.5N': 30,'21C': 20, '21N': 95,
  '21W': 30, '22C': 10, '22N': 20, '22W': 5,  '23N': 40,
  '24N': 20, '24W': 10, '25N': 20, '27C': 5,  '27N': 10,
  '28N': 10, '29C': 5,  '29N': 5,  '30N': 5,  '31N': 5,
  '33C': 5,  '33N': 5,  '33W': 5,  '34C': 5,  '34N': 5,
  '34W': 5,  '35N': 5,  '37C': 5,  '40N': 5,  '43N': 5,
  '45N': 5,  '45W': 5,  '47N': 5,  '51N': 5,  '55N': 5,
};
const US_SHADE: Record<string, number> = {
  '10C': 5,  '13C': 10, '13N': 20, '13W': 5,  '13.5N': 10,
  '15C': 30, '15.5N': 20,'17C': 50, '17N': 40, '17W': 10,
  '19C': 40, '19N': 30, '19.5N': 30,'21C': 20, '21N': 28,
  '21W': 50, '22C': 20, '22N': 60, '22W': 20, '23N': 90,
  '24N': 70, '24W': 50, '25N': 100,'27C': 20, '27N': 80,
  '28N': 70, '29C': 20, '29N': 100,'30N': 60, '31N': 50,
  '33C': 20, '33N': 80, '33W': 20, '34C': 20, '34N': 40,
  '34W': 10, '35N': 90, '37C': 20, '40N': 70, '43N': 60,
  '45N': 20, '45W': 20, '47N': 10, '51N': 5,  '55N': 5,
};

// ── Mock dataset: 4 products × 3 countries ─────────────────────────────────────
export const MOCK_DATA: Record<string, Record<string, CountryMetrics>> = {
  // ─── 마스크핏 레드 쿠션 ─────────────────────────────────────────────────────
  red: {
    KOR: {
      totalSalesK: 680, momGrowth: 18, momTarget: 15,
      velocity: [
        { day: 'DAY 01', amazon: 15, tiktok: 28, offline: 42 },
        { day: 'DAY 07', amazon: 22, tiktok: 38, offline: 40 },
        { day: 'DAY 14', amazon: 38, tiktok: 65, offline: 35 },
        { day: 'DAY 21', amazon: 30, tiktok: 55, offline: 32 },
        { day: 'DAY 28', amazon: 45, tiktok: 82, offline: 25 },
      ],
      shadeIntensity: KOR_SHADE,
      inventory: [
        { shade: '21N Natural', code: '21N', stock: 8200, burnRate: 420 },
        { shade: '17C Light',   code: '17C', stock: 3100, burnRate: 280 },
        { shade: '23N Sand',    code: '23N', stock: 5600, burnRate: 310 },
        { shade: '15C Fair',    code: '15C', stock: 2800, burnRate: 58  },
      ],
      deadStock: [
        { shade: '13W Ivory', months: 4.2, lossKRW: 3200000 },
        { shade: '22W Beige', months: 3.1, lossKRW: 1400000 },
      ],
      femalePct: 88, ageGroup: '여성, 20-29세',
      vipCount: 1800, atRiskCount: 620, newViralCount: 2100,
      actionShade: '13W', actionMarket: '한국', actionTarget: 800, actionRoi: '3.8x',
    },
    JP: {
      totalSalesK: 340, momGrowth: 12, momTarget: 10,
      velocity: [
        { day: 'DAY 01', amazon: 32, tiktok: 8,  offline: 20 },
        { day: 'DAY 07', amazon: 48, tiktok: 12, offline: 18 },
        { day: 'DAY 14', amazon: 92, tiktok: 18, offline: 14 },
        { day: 'DAY 21', amazon: 55, tiktok: 22, offline: 16 },
        { day: 'DAY 28', amazon: 98, tiktok: 30, offline: 10 },
      ],
      shadeIntensity: JP_SHADE,
      inventory: [
        { shade: '15C Fair',  code: '15C', stock: 2100, burnRate: 185 },
        { shade: '13N Ivory', code: '13N', stock: 4800, burnRate: 125 },
        { shade: '17C Light', code: '17C', stock: 1900, burnRate: 98  },
        { shade: '13W White', code: '13W', stock: 3200, burnRate: 38  },
      ],
      deadStock: [
        { shade: '34W Deep', months: 3.8, lossKRW: 2100000 },
        { shade: '33W Tan',  months: 3.2, lossKRW: 980000  },
      ],
      femalePct: 92, ageGroup: '여성, 18-27세',
      vipCount: 950, atRiskCount: 280, newViralCount: 880,
      actionShade: '34W', actionMarket: '일본', actionTarget: 400, actionRoi: '2.9x',
    },
    US: {
      totalSalesK: 180, momGrowth: 8, momTarget: 12,
      velocity: [
        { day: 'DAY 01', amazon: 48,  tiktok: 20, offline: 10 },
        { day: 'DAY 07', amazon: 65,  tiktok: 28, offline: 8  },
        { day: 'DAY 14', amazon: 145, tiktok: 45, offline: 6  },
        { day: 'DAY 21', amazon: 92,  tiktok: 58, offline: 7  },
        { day: 'DAY 28', amazon: 168, tiktok: 75, offline: 5  },
      ],
      shadeIntensity: US_SHADE,
      inventory: [
        { shade: '29N Warm',  code: '29N', stock: 6400, burnRate: 315 },
        { shade: '25N Sand',  code: '25N', stock: 3800, burnRate: 208 },
        { shade: '23N Beige', code: '23N', stock: 5100, burnRate: 182 },
        { shade: '40N Deep',  code: '40N', stock: 2200, burnRate: 52  },
      ],
      deadStock: [
        { shade: '13C Bright', months: 5.1, lossKRW: 4100000 },
        { shade: '10C White',  months: 4.5, lossKRW: 2800000 },
      ],
      femalePct: 78, ageGroup: '여성, 22-35세',
      vipCount: 680, atRiskCount: 420, newViralCount: 950,
      actionShade: '13C', actionMarket: '미국', actionTarget: 300, actionRoi: '5.1x',
    },
  },

  // ─── 마스크핏 AI 필터 쿠션 ──────────────────────────────────────────────────
  ai: {
    KOR: {
      totalSalesK: 480, momGrowth: 22, momTarget: 18,
      velocity: [
        { day: 'DAY 01', amazon: 12, tiktok: 35, offline: 30 },
        { day: 'DAY 07', amazon: 18, tiktok: 48, offline: 28 },
        { day: 'DAY 14', amazon: 28, tiktok: 78, offline: 22 },
        { day: 'DAY 21', amazon: 22, tiktok: 65, offline: 20 },
        { day: 'DAY 28', amazon: 35, tiktok: 95, offline: 18 },
      ],
      shadeIntensity: KOR_SHADE,
      inventory: [
        { shade: '17C Light',   code: '17C', stock: 6200, burnRate: 380 },
        { shade: '15C Fair',    code: '15C', stock: 4100, burnRate: 290 },
        { shade: '21N Natural', code: '21N', stock: 7800, burnRate: 310 },
        { shade: '19C Nude',    code: '19C', stock: 2200, burnRate: 48  },
      ],
      deadStock: [
        { shade: '33W Deep', months: 3.5, lossKRW: 2800000 },
        { shade: '40N Dark', months: 3.1, lossKRW: 1200000 },
      ],
      femalePct: 86, ageGroup: '여성, 18-28세',
      vipCount: 1200, atRiskCount: 480, newViralCount: 2800,
      actionShade: '33W', actionMarket: '한국', actionTarget: 600, actionRoi: '4.2x',
    },
    JP: {
      totalSalesK: 250, momGrowth: 15, momTarget: 12,
      velocity: [
        { day: 'DAY 01', amazon: 25, tiktok: 10, offline: 18 },
        { day: 'DAY 07', amazon: 38, tiktok: 14, offline: 16 },
        { day: 'DAY 14', amazon: 72, tiktok: 20, offline: 12 },
        { day: 'DAY 21', amazon: 44, tiktok: 25, offline: 14 },
        { day: 'DAY 28', amazon: 80, tiktok: 35, offline: 8  },
      ],
      shadeIntensity: JP_SHADE,
      inventory: [
        { shade: '13N Porcelain', code: '13N', stock: 3200, burnRate: 155 },
        { shade: '15C Fair',      code: '15C', stock: 2800, burnRate: 138 },
        { shade: '17C Light',     code: '17C', stock: 1600, burnRate: 82  },
        { shade: '35N Tan',       code: '35N', stock: 4800, burnRate: 28  },
      ],
      deadStock: [
        { shade: '35N Tan',  months: 4.2, lossKRW: 1800000 },
        { shade: '43N Dark', months: 3.8, lossKRW: 950000  },
      ],
      femalePct: 91, ageGroup: '여성, 17-26세',
      vipCount: 720, atRiskCount: 210, newViralCount: 1100,
      actionShade: '35N', actionMarket: '일본', actionTarget: 320, actionRoi: '3.3x',
    },
    US: {
      totalSalesK: 140, momGrowth: 18, momTarget: 15,
      velocity: [
        { day: 'DAY 01', amazon: 38,  tiktok: 25, offline: 8 },
        { day: 'DAY 07', amazon: 52,  tiktok: 35, offline: 6 },
        { day: 'DAY 14', amazon: 115, tiktok: 55, offline: 4 },
        { day: 'DAY 21', amazon: 72,  tiktok: 68, offline: 5 },
        { day: 'DAY 28', amazon: 135, tiktok: 88, offline: 3 },
      ],
      shadeIntensity: US_SHADE,
      inventory: [
        { shade: '23N Beige', code: '23N', stock: 5200, burnRate: 288 },
        { shade: '25N Sand',  code: '25N', stock: 4100, burnRate: 220 },
        { shade: '27N Warm',  code: '27N', stock: 3800, burnRate: 165 },
        { shade: '13C Pale',  code: '13C', stock: 1800, burnRate: 28  },
      ],
      deadStock: [
        { shade: '10C White', months: 4.8, lossKRW: 3500000 },
        { shade: '13W Ivory', months: 3.9, lossKRW: 2200000 },
      ],
      femalePct: 76, ageGroup: '여성, 20-33세',
      vipCount: 520, atRiskCount: 380, newViralCount: 1100,
      actionShade: '10C', actionMarket: '미국', actionTarget: 250, actionRoi: '4.8x',
    },
  },

  // ─── 마스크핏 루비 메쉬 쿠션 ────────────────────────────────────────────────
  ruby: {
    KOR: {
      totalSalesK: 320, momGrowth: 14, momTarget: 12,
      velocity: [
        { day: 'DAY 01', amazon: 10, tiktok: 22, offline: 38 },
        { day: 'DAY 07', amazon: 15, tiktok: 30, offline: 35 },
        { day: 'DAY 14', amazon: 25, tiktok: 52, offline: 30 },
        { day: 'DAY 21', amazon: 18, tiktok: 42, offline: 28 },
        { day: 'DAY 28', amazon: 30, tiktok: 65, offline: 22 },
      ],
      shadeIntensity: KOR_SHADE,
      inventory: [
        { shade: '23N Sand',   code: '23N', stock: 6800, burnRate: 355 },
        { shade: '21W Beige',  code: '21W', stock: 4200, burnRate: 220 },
        { shade: '25N Medium', code: '25N', stock: 5500, burnRate: 185 },
        { shade: '27N Warm',   code: '27N', stock: 2100, burnRate: 42  },
      ],
      deadStock: [
        { shade: '51N Dark', months: 5.2, lossKRW: 4800000 },
        { shade: '47N Deep', months: 4.1, lossKRW: 3100000 },
      ],
      femalePct: 85, ageGroup: '여성, 22-35세',
      vipCount: 1100, atRiskCount: 380, newViralCount: 1400,
      actionShade: '51N', actionMarket: '한국', actionTarget: 500, actionRoi: '3.2x',
    },
    JP: {
      totalSalesK: 180, momGrowth: 9, momTarget: 10,
      velocity: [
        { day: 'DAY 01', amazon: 22, tiktok: 6,  offline: 18 },
        { day: 'DAY 07', amazon: 35, tiktok: 9,  offline: 15 },
        { day: 'DAY 14', amazon: 68, tiktok: 14, offline: 11 },
        { day: 'DAY 21', amazon: 42, tiktok: 18, offline: 13 },
        { day: 'DAY 28', amazon: 75, tiktok: 24, offline: 8  },
      ],
      shadeIntensity: JP_SHADE,
      inventory: [
        { shade: '17C Light', code: '17C', stock: 2800, burnRate: 175 },
        { shade: '15C Fair',  code: '15C', stock: 3500, burnRate: 140 },
        { shade: '19C Nude',  code: '19C', stock: 1900, burnRate: 72  },
        { shade: '29N Warm',  code: '29N', stock: 3800, burnRate: 22  },
      ],
      deadStock: [
        { shade: '43N Dark', months: 4.5, lossKRW: 2600000 },
        { shade: '40N Deep', months: 3.7, lossKRW: 1700000 },
      ],
      femalePct: 90, ageGroup: '여성, 18-28세',
      vipCount: 580, atRiskCount: 165, newViralCount: 720,
      actionShade: '43N', actionMarket: '일본', actionTarget: 280, actionRoi: '2.6x',
    },
    US: {
      totalSalesK: 110, momGrowth: 5, momTarget: 8,
      velocity: [
        { day: 'DAY 01', amazon: 32,  tiktok: 15, offline: 8 },
        { day: 'DAY 07', amazon: 45,  tiktok: 22, offline: 6 },
        { day: 'DAY 14', amazon: 98,  tiktok: 38, offline: 4 },
        { day: 'DAY 21', amazon: 62,  tiktok: 48, offline: 5 },
        { day: 'DAY 28', amazon: 115, tiktok: 62, offline: 3 },
      ],
      shadeIntensity: US_SHADE,
      inventory: [
        { shade: '29N Warm', code: '29N', stock: 5800, burnRate: 295 },
        { shade: '33N Tan',  code: '33N', stock: 3200, burnRate: 175 },
        { shade: '27N Sand', code: '27N', stock: 4500, burnRate: 145 },
        { shade: '15C Pale', code: '15C', stock: 1500, burnRate: 20  },
      ],
      deadStock: [
        { shade: '13C White', months: 5.5, lossKRW: 4800000 },
        { shade: '10C Ivory', months: 4.8, lossKRW: 3200000 },
      ],
      femalePct: 74, ageGroup: '여성, 24-38세',
      vipCount: 420, atRiskCount: 310, newViralCount: 780,
      actionShade: '13C', actionMarket: '미국', actionTarget: 200, actionRoi: '3.8x',
    },
  },

  // ─── 마스크핏 크리스탈 메쉬 쿠션 ───────────────────────────────────────────
  crystal: {
    KOR: {
      totalSalesK: 240, momGrowth: 16, momTarget: 12,
      velocity: [
        { day: 'DAY 01', amazon: 8,  tiktok: 18, offline: 32 },
        { day: 'DAY 07', amazon: 12, tiktok: 25, offline: 30 },
        { day: 'DAY 14', amazon: 20, tiktok: 45, offline: 25 },
        { day: 'DAY 21', amazon: 15, tiktok: 38, offline: 22 },
        { day: 'DAY 28', amazon: 25, tiktok: 58, offline: 18 },
      ],
      shadeIntensity: KOR_SHADE,
      inventory: [
        { shade: '17C Light', code: '17C', stock: 5100, burnRate: 310 },
        { shade: '19C Nude',  code: '19C', stock: 3800, burnRate: 225 },
        { shade: '22N Beige', code: '22N', stock: 4600, burnRate: 145 },
        { shade: '35N Tan',   code: '35N', stock: 1800, burnRate: 38  },
      ],
      deadStock: [
        { shade: '47N Dark', months: 4.8, lossKRW: 3900000 },
        { shade: '43N Deep', months: 3.6, lossKRW: 2200000 },
      ],
      femalePct: 87, ageGroup: '여성, 20-32세',
      vipCount: 880, atRiskCount: 290, newViralCount: 1100,
      actionShade: '47N', actionMarket: '한국', actionTarget: 400, actionRoi: '2.8x',
    },
    JP: {
      totalSalesK: 160, momGrowth: 11, momTarget: 10,
      velocity: [
        { day: 'DAY 01', amazon: 20, tiktok: 5,  offline: 15 },
        { day: 'DAY 07', amazon: 30, tiktok: 8,  offline: 12 },
        { day: 'DAY 14', amazon: 58, tiktok: 12, offline: 9  },
        { day: 'DAY 21', amazon: 38, tiktok: 15, offline: 11 },
        { day: 'DAY 28', amazon: 65, tiktok: 20, offline: 7  },
      ],
      shadeIntensity: JP_SHADE,
      inventory: [
        { shade: '13N Porcelain', code: '13N', stock: 2600, burnRate: 145 },
        { shade: '15C Fair',      code: '15C', stock: 3100, burnRate: 115 },
        { shade: '17C Light',     code: '17C', stock: 1500, burnRate: 65  },
        { shade: '33N Tan',       code: '33N', stock: 4200, burnRate: 18  },
      ],
      deadStock: [
        { shade: '33N Tan',  months: 3.9, lossKRW: 1500000 },
        { shade: '35N Sand', months: 3.2, lossKRW: 850000  },
      ],
      femalePct: 93, ageGroup: '여성, 17-25세',
      vipCount: 490, atRiskCount: 145, newViralCount: 620,
      actionShade: '33N', actionMarket: '일본', actionTarget: 220, actionRoi: '2.4x',
    },
    US: {
      totalSalesK: 90, momGrowth: 6, momTarget: 8,
      velocity: [
        { day: 'DAY 01', amazon: 28, tiktok: 12, offline: 7 },
        { day: 'DAY 07', amazon: 40, tiktok: 18, offline: 5 },
        { day: 'DAY 14', amazon: 85, tiktok: 30, offline: 3 },
        { day: 'DAY 21', amazon: 52, tiktok: 42, offline: 4 },
        { day: 'DAY 28', amazon: 98, tiktok: 55, offline: 2 },
      ],
      shadeIntensity: US_SHADE,
      inventory: [
        { shade: '27N Sand',   code: '27N', stock: 4800, burnRate: 258 },
        { shade: '25N Medium', code: '25N', stock: 3500, burnRate: 188 },
        { shade: '29N Warm',   code: '29N', stock: 4100, burnRate: 125 },
        { shade: '13N Pale',   code: '13N', stock: 1200, burnRate: 15  },
      ],
      deadStock: [
        { shade: '10C White', months: 5.8, lossKRW: 5200000 },
        { shade: '13C Ivory', months: 4.2, lossKRW: 2900000 },
      ],
      femalePct: 72, ageGroup: '여성, 23-40세',
      vipCount: 350, atRiskCount: 260, newViralCount: 620,
      actionShade: '10C', actionMarket: '미국', actionTarget: 180, actionRoi: '4.2x',
    },
  },
};

// ── Aggregate metrics from selected countries ──────────────────────────────────
export function aggregateMetrics(metrics: CountryMetrics[]): CountryMetrics {
  if (metrics.length === 1) return metrics[0];

  const totalSalesK = metrics.reduce((s, m) => s + m.totalSalesK, 0);

  // Weighted average MoM growth by sales volume
  const momGrowth = Math.round(
    (metrics.reduce((s, m) => s + m.momGrowth * m.totalSalesK, 0) / totalSalesK) * 10
  ) / 10;

  const momTarget = Math.round(
    metrics.reduce((s, m) => s + m.momTarget, 0) / metrics.length
  );

  // Sum velocity point-by-point
  const velocity = metrics[0].velocity.map((_, i) => ({
    day: metrics[0].velocity[i].day,
    amazon:  metrics.reduce((s, m) => s + m.velocity[i].amazon,  0),
    tiktok:  metrics.reduce((s, m) => s + m.velocity[i].tiktok,  0),
    offline: metrics.reduce((s, m) => s + m.velocity[i].offline, 0),
  }));

  // Weighted average shade intensity → snap to valid bucket
  const allNames = Object.keys(metrics[0].shadeIntensity);
  const shadeIntensity: Record<string, number> = {};
  allNames.forEach(name => {
    const weightedAvg =
      metrics.reduce((s, m) => s + (m.shadeIntensity[name] ?? 5) * m.totalSalesK, 0) / totalSalesK;
    shadeIntensity[name] = snapIntensity(weightedAvg);
  });

  // Merge inventory by shade code (sum stock + burnRate), sort by urgency (lowest D-Day first)
  const invMap: Record<string, InventoryRow> = {};
  metrics.forEach(m => {
    m.inventory.forEach(item => {
      if (invMap[item.code]) {
        invMap[item.code] = {
          ...invMap[item.code],
          stock:    invMap[item.code].stock    + item.stock,
          burnRate: invMap[item.code].burnRate + item.burnRate,
        };
      } else {
        invMap[item.code] = { ...item };
      }
    });
  });
  const inventory = Object.values(invMap)
    .sort((a, b) => (a.stock / a.burnRate) - (b.stock / b.burnRate))
    .slice(0, 4);

  // Union dead stock: max months, sum loss
  const dsMap: Record<string, DeadStockRow> = {};
  metrics.forEach(m => {
    m.deadStock.forEach(item => {
      if (dsMap[item.shade]) {
        dsMap[item.shade] = {
          shade:    item.shade,
          months:   Math.max(dsMap[item.shade].months, item.months),
          lossKRW:  dsMap[item.shade].lossKRW + item.lossKRW,
        };
      } else {
        dsMap[item.shade] = { ...item };
      }
    });
  });
  const deadStock = Object.values(dsMap)
    .sort((a, b) => b.months - a.months)
    .slice(0, 3);

  // Demographics: femalePct weighted by sales, counts summed
  const femalePct = Math.round(
    metrics.reduce((s, m) => s + m.femalePct * m.totalSalesK, 0) / totalSalesK
  );

  // Action card: use the dominant (highest-sales) country's recommendation
  const dominant = metrics.reduce((a, b) => a.totalSalesK > b.totalSalesK ? a : b);

  return {
    totalSalesK,
    momGrowth,
    momTarget,
    velocity,
    shadeIntensity,
    inventory,
    deadStock,
    femalePct,
    ageGroup:      dominant.ageGroup,
    vipCount:      metrics.reduce((s, m) => s + m.vipCount,      0),
    atRiskCount:   metrics.reduce((s, m) => s + m.atRiskCount,   0),
    newViralCount: metrics.reduce((s, m) => s + m.newViralCount, 0),
    actionShade:   dominant.actionShade,
    actionMarket:  metrics.map(m => m.actionMarket).join(' · '),
    actionTarget:  metrics.reduce((s, m) => s + m.actionTarget,  0),
    actionRoi:     dominant.actionRoi,
  };
}

// ── Formatters ─────────────────────────────────────────────────────────────────
export function formatSalesK(k: number): string {
  if (k >= 1000) return `$${(k / 1000).toFixed(1)}M`;
  return `$${k}K`;
}

export function formatLossKRW(krw: number): string {
  if (krw >= 1000000) return `₩${(krw / 1000000).toFixed(1)}M`;
  return `₩${Math.round(krw / 1000)}K`;
}

export function dDayBadge(dDay: number): { label: string; className: string } {
  if (dDay <= 14) return { label: `D-${dDay} 🚨`, className: 'bg-red-100 text-red-600' };
  if (dDay <= 30) return { label: `D-${dDay} ⚠️`,  className: 'bg-yellow-100 text-yellow-600' };
  return             { label: `D-${dDay} ✅`,  className: 'bg-emerald-100 text-emerald-600' };
}
