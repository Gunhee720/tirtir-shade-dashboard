'use strict';
/**
 * TIRTIR KOR 비즈니스 시나리오 데이터 적재 스크립트 v2
 * ─────────────────────────────────────────────────────
 * 개선사항:
 *   1. 쉐이드 커버리지 확대 (리뷰=수요 관점, 38개 이상 쉐이드 색상)
 *   2. 채널별 소진속도 변화: 요일효과 + 올리브영 프로모 스파이크 + 성장 추세
 *   3. 재고 D-Day 시나리오:
 *       D-14  (CRITICAL 🚨) : 21N, 17C
 *       D-21  (WARNING  ⚠️) : 19C, AI 21N
 *       D-30  (주의)        : 2티어 인기 쉐이드
 *       D-60  (안정)        : 미들 쉐이드
 *       악성재고             : 어두운 쉐이드 (판매 없음, 재고 과다)
 */
const https = require('https');

const SUPABASE_HOST = 'slrxdpbszhrirrkmpfyy.supabase.co';
const SERVICE_KEY   =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscnhkcGJzemhyaXJya21wZnl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcxNjM2NiwiZXhwIjoyMDg5MjkyMzY2fQ.DYZmMdKE3TQSnn9e6GKQ1w2zwtHq2JYjJEFAmH7PUwY';

// ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────
function toISO(d) { return d.toISOString().split('T')[0]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
const TODAY = new Date(); TODAY.setHours(0,0,0,0);

// ── 난수 헬퍼 ─────────────────────────────────────────────────────────────────
function randn() {
  let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

// ── 요일별 채널 가중치 (0=일, 1=월 ... 6=토) ─────────────────────────────────
// 올리브영(offline): 주말 피크  /  자사몰(amazon): 평일 피크
const WEEKDAY_OFFLINE = [1.35, 0.85, 0.90, 0.95, 1.05, 1.25, 1.50]; // 일~토
const WEEKDAY_AMAZON  = [0.75, 1.10, 1.15, 1.15, 1.20, 1.10, 0.80];

// ── 시계열 변화 요인 계산 ─────────────────────────────────────────────────────
// daysBack 기준으로 날짜별 판매량 가중치 계산
// - 전체 기간 성장 트렌드 +25% (D-100 → D-1)
// - 현재기간(D-28~D-15) 올리브영 프로모 스파이크 +60%
// - sin 파형으로 자연스러운 주간 리듬 추가
function getDailyFactor(date, daysBack, channel) {
  const dow = date.getDay(); // 요일
  const weekdayFactor = channel === 'offline'
    ? WEEKDAY_OFFLINE[dow]
    : WEEKDAY_AMAZON[dow];

  // 선형 성장 트렌드: 100일 전 → 현재 +25%
  const trendFactor = 1.0 + (100 - daysBack) / 100 * 0.25;

  // 올리브영 프로모 스파이크 (D-25 ~ D-15 구간: 올영 SALE 시뮬)
  const promiFactor = (channel === 'offline' && daysBack >= 15 && daysBack <= 25)
    ? 1.65
    : 1.0;

  // sin 파형 (2주 주기): 자연스러운 리듬
  const sinFactor = 1.0 + Math.sin(daysBack * Math.PI / 7) * 0.08;

  // Gaussian 노이즈
  const noise = 1.0 + randn() * 0.12;

  return weekdayFactor * trendFactor * promiFactor * sinFactor * noise;
}

// ── 확장된 KOR 수요 데이터 (리뷰=수요 관점으로 long-tail 추가) ──────────────
// 원본 리뷰 수 × SCALE = 90일 기준 총 판매 추정
const SCALE = 10;

const DEMAND_KOR = {
  red: {
    offline: {
      // ─────────────────────────────────────────────────────────────────
      // 올리브영 레드쿠션 — snapIntensity 5단계 설계 (MAX=200)
      // 비율이 snapIntensity 버킷 [5,20,40,70,100]에 정확히 매핑
      // ─────────────────────────────────────────────────────────────────
      // ── 5단계 (intensity ≥85%, snapTo=100) — 21N, 17C, 19C ─────────
      '21N': 200, '17C': 195, '19C': 180,
      // ── 4단계 (intensity 55-84%, snapTo=70) — 다음 6개 ──────────────
      '21C': 145, '10C': 135, '13C': 130,
      '19N': 125, '15C': 120, '23N': 115,
      // ── 3단계 (intensity 30-54%, snapTo=40) — 다음 6개 ──────────────
      '17N': 100, '24N': 92,  '22N': 85,
      '13N': 78,  '19.5N': 72,'21W': 65,
      // ── 2단계 (intensity 13-29%, snapTo=20) — 다음 6개 ──────────────
      '15.5N': 50,'22W': 44,  '13.5N': 40,
      '25N': 36,  '29N': 32,  '13W': 28,
      // ── 1단계 (intensity ≤12%, snapTo=5) — 나머지 txt 쉐이드 ────────
      '22C': 20, '24W': 18, '28N': 16,
      '17W': 14, '27C': 10, '27N': 10, '29C': 10,
      // Long-tail (히트맵 커버리지 보완, 1단계)
      '30N': 8, '31N': 7, '33C': 7, '33N': 8, '33W': 6,
      '34C': 6, '34N': 7, '35N': 6,
    },
    amazon: {
      // ─────────────────────────────────────────────────────────────────
      // 자사몰 레드쿠션 (3단계 수요 계층)
      // Level 3 (~55-100%): Top3 — 21N > 23N > 17C
      // Level 2 (~29-35%): 원본 txt count 2-3 쉐이드
      // Level 1 (~21-23%): 원본 txt count=1 쉐이드 (히트맵에 색 표현)
      // ─────────────────────────────────────────────────────────────────
      '21N': 70,  // ① Level 3: ~100%
      '23N': 50,  // ② Level 3: ~66%
      '17C': 40,  // ③ Level 3: ~55%
      '19C': 30,  // Level 2: ~34%  (원본 count=3)
      '17W': 25, '22N': 25,          // Level 2: ~29%  (원본 count=2)
      // 원본 txt count=1 쉐이드 → Level 1: ~23% (히트맵 색상 표현 보장)
      '10C': 20,'13W':20,'15C':20,'19N':20,
      '21W': 20,'21C':20,'22W':20,'24W':20,
      // 커버리지 보완 쉐이드 (원본 미포함, Level 1 동일)
      '13N': 20,'13.5N':20,'19.5N':20,
      // 37C: 원본 count=1, 어두운 쉐이드 (약간 낮게)
      '37C': 18,
    },
  },
  ai: {
    offline: {
      // ─────────────────────────────────────────────────────────────────
      // 올리브영 AI쿠션 — snapIntensity 5단계 설계 (MAX=200)
      // 원본 txt 15개 쉐이드 전체 색상 표현 + 2단계 이상 보장
      // ─────────────────────────────────────────────────────────────────
      // TOP3: 17C > 19C > 21N (21N과 4위 15C 간격 65pt 확보, 노이즈 역전 방지)
      // ── 5단계 (intensity ≥85%, snapTo=100) — TOP1, TOP2 ──────────────
      '17C': 200, '19C': 182,
      // ── 4단계 (intensity 55-84%, snapTo=70) — TOP3 ───────────────────
      '21N': 165,  // 82.5% → 4단계
      // ── 3단계 (intensity 30-54%, snapTo=40) ──────────────────────────
      '15C': 100, '13N': 90,
      '15.5N': 80, '19N': 70, '17N': 62, '19.5N': 54,
      // ── 2단계 (intensity 13-29%, snapTo=20) ──────────────────────────
      '13.5N': 45, '21C': 38, '22N': 33, '23N': 28, '24N': 22,
      // ── 1단계 (intensity ≤12%, snapTo=5) ─────────────────────────────
      '29N': 18,
    },
    amazon: {
      // ─────────────────────────────────────────────────────────────────
      // 자사몰 AI쿠션 — TOP3: 21N > 15.5N > 19.5N
      // 전체(combined) 기준 21N > 17C 보장:
      //   17C는 offline이 강하므로 amazon은 낮게 유지(25) →
      //   21N amazon을 크게 올려 combined 21N이 17C보다 ~20% 높게
      // Level 3: 21N(100%) > 15.5N(69%) > 19.5N(50%)
      // Level 2 (~20-27%): 19C, 13N, 15C / 17C(19%→2단계 유지)
      // Level 1 (~17%): 원본 txt count=1 쉐이드
      // ─────────────────────────────────────────────────────────────────
      '21N':   130, // ① TOP1: 100% (5단계) — combined 기준도 1위 확보
      '15.5N':  90, // ② TOP2:  69% (4단계)
      '19.5N':  65, // ③ TOP3:  50% (3단계)
      '17C':    25, // ④:       19% (2단계) — 낮게 유지 → combined 17C<21N
      '19C':    35, // ⑤:       27% (2단계)
      '13N':    27, '15C': 27,        // ~21% (2단계)
      // 원본 txt count=1 쉐이드 → ~17% (2단계, 히트맵 색상 보장)
      '17N':    22, '19N': 22,
      '30N':    22, '13.5N': 22, '21C': 22,
    },
  },
};

// ── 중복 제거 및 병합 (shade_code 기준 합산) ──────────────────────────────────
function mergeShadeMap(shadeMap) {
  const merged = {};
  for (const [shade, cnt] of Object.entries(shadeMap)) {
    merged[shade] = (merged[shade] || 0) + cnt;
  }
  return merged;
}

// mergeShadeMap: 중복 shade_code 합산 (현재 AI offline은 중복 없음, 안전 처리)
DEMAND_KOR.ai.offline = mergeShadeMap(DEMAND_KOR.ai.offline);

// ruby / crystal: red 상위 10쉐이드 40% / 30% 스케일
const RUBY_DEMAND = {
  offline: {'21N':87,'17C':85,'19C':48,'21C':31,'10C':22,'13C':21,'19N':18,'15C':14,'23N':14,'17N':14,'22N':10,'24N':11,'13N':10,'19.5N':8,'21W':7},
};
const CRYSTAL_DEMAND = {
  offline: {'21N':65,'17C':64,'19C':36,'21C':23,'10C':16,'13C':16,'19N':13,'15C':11,'23N':11,'17N':10,'22N':8,'24N':8,'13N':7,'19.5N':6},
};

// ── 전체 45 쉐이드 ────────────────────────────────────────────────────────────
const ALL_SHADES = [
  '10C','13C','13N','13W','13.5N','15C','15.5N','17C','17N','17W',
  '19C','19N','19.5N','21C','21N','21W','22C','22N','22W','23N',
  '24N','24W','25N','27C','27N','28N','29C','29N','30N','31N',
  '33C','33N','33W','34C','34N','34W','35N','37C','40N','43N',
  '45N','45W','47N','51N','55N',
];

const PRICES = { red:12.0, ai:14.0, ruby:13.0, crystal:13.5 };

// D-Day 시나리오: 쉐이드별 목표 재고일 설정
// 번율(burn_rate) × targetDays = INBOUND 수량
const DDAY_TIERS = {
  red: {
    // 🚨 D-14 CRITICAL
    '21N':14,'17C':14,
    // ⚠️ D-21 WARNING
    '19C':21,'21C':21,'23N':21, // 23N: 자사몰 2위로 수요 확대 → WARNING 격상
    // D-30 주의
    '10C':30,'13C':30,'19N':30,'15C':30,'17N':30,
    // D-45 안정
    '24N':45,'22N':45,'13N':45,'19.5N':45,'21W':45,'15.5N':45,
    '22W':50,'13.5N':50,'25N':55,'29N':55,
    // D-70 충분
    '13W':70,'22C':70,'24W':70,'28N':70,'17W':70,
    '27C':80,'27N':80,'29C':80,
    // D-90+ (미들다크, 소량 수요)
    '30N':90,'31N':90,'33C':95,'33N':90,'33W':95,'34C':100,'34N':95,'35N':100,
    // 악성재고 쉐이드 (37C는 소량 수요 있음)
    '37C':120,
  },
  ai: {
    // 🚨 D-14 CRITICAL
    '17C':14,'19C':14,
    // ⚠️ D-21 WARNING
    '21N':21,'15C':21,
    // D-30 주의
    '13N':30,'15.5N':30,'19N':30,'17N':35,
    // D-45 안정
    '19.5N':45,'13.5N':45,'21C':45,'22N':50,
    // D-60+
    '23N':60,'24N':65,'29N':70,
    '21W':75,'22C':75,'22W':75,'24W':75,'25N':75,
    '13W':80,'17W':80,'10C':80,'13C':80,'13.5N':45, // de-dup
    '27C':90,'27N':90,'28N':90,
  },
};

// ── REST API 헬퍼 ──────────────────────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: SUPABASE_HOST, path, method,
      headers: {
        'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST'
          ? 'return=minimal,resolution=merge-duplicates'
          : 'return=minimal',
        ...(data ? {'Content-Length': Buffer.byteLength(data)} : {}),
      },
    };
    const req = https.request(opts, res => {
      let buf=''; res.on('data', c => buf+=c);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`${method} ${path} → ${res.statusCode}: ${buf}`));
        else resolve(buf);
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function deleteRows(table, filter) {
  console.log(`  🗑  DELETE ${table} WHERE ${filter}`);
  await request('DELETE', `/rest/v1/${table}?${filter}`);
}

async function insertBatch(table, rows, batchSize=500) {
  for (let i=0; i<rows.length; i+=batchSize) {
    await request('POST', `/rest/v1/${table}`, rows.slice(i, i+batchSize));
    process.stdout.write(`\r  📥  ${table}: ${Math.min(i+batchSize, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
  }
  console.log();
}

// ── STEP 1: 삭제 ──────────────────────────────────────────────────────────────
async function deleteKorData() {
  console.log('\n[STEP 1] KOR 기존 데이터 삭제');
  await deleteRows('sales_order',      'country=eq.KOR');
  await deleteRows('inventory_ledger', 'country=eq.KOR');
  await deleteRows('customer_segment', 'country=eq.KOR');
  console.log('  ✅ 삭제 완료');
}

// ── STEP 2: sales_order 적재 ─────────────────────────────────────────────────
// 요일 효과 + 프로모 스파이크 + 성장 트렌드 반영
async function seedSalesOrders() {
  console.log('\n[STEP 2] KOR sales_order 적재 (요일효과 + 프로모 스파이크)');
  const rows = [];

  const seedProduct = (productId, demandByChannel) => {
    const price = PRICES[productId];
    for (const [channel, rawShadeMap] of Object.entries(demandByChannel)) {
      const shadeMap = mergeShadeMap(rawShadeMap);
      for (const [shade, reviewCount] of Object.entries(shadeMap)) {
        if (!ALL_SHADES.includes(shade)) continue;

        // 90일 기준 일평균 (리뷰×SCALE÷90)
        const dailyBase = (reviewCount * SCALE) / 90;

        for (let daysBack = 100; daysBack >= 1; daysBack--) {
          const date = addDays(TODAY, -daysBack);
          const factor = getDailyFactor(date, daysBack, channel);
          // amazon(자사몰): 소량·산발 구매 특성 → Math.max(1,...) 미사용
          // 낮은 수요 쉐이드는 일부 날만 판매 (현실적 희박성 반영)
          const qty = channel === 'amazon'
            ? Math.round(dailyBase * factor)
            : Math.max(1, Math.round(dailyBase * factor));
          if (qty <= 0) continue; // 판매 없는 날은 행 생성 생략
          rows.push({
            product_id:     productId,
            shade_code:     shade,
            country:        'KOR',
            channel,
            sale_date:      toISO(date),
            quantity:       qty,
            unit_price_usd: price,
          });
        }
      }
    }
  };

  seedProduct('red',     DEMAND_KOR.red);
  seedProduct('ai',      DEMAND_KOR.ai);
  seedProduct('ruby',    RUBY_DEMAND);
  seedProduct('crystal', CRYSTAL_DEMAND);

  console.log(`  총 ${rows.length.toLocaleString()}개 행 생성`);
  await insertBatch('sales_order', rows);
  console.log('  ✅ sales_order 완료');
}

// ── STEP 3: inventory_ledger — D-Day 시나리오 기반 ───────────────────────────
async function seedInventory() {
  console.log('\n[STEP 3] KOR inventory_ledger 적재 (D-Day 시나리오)');
  const rows = [];
  const inboundDate = toISO(addDays(TODAY, -5)); // 최근 입고

  // 쉐이드별 28일 예상 소진량 계산 (burn_rate 근사)
  // burn_rate = 28일 판매 합계 / 30 (RPC 방식)
  // 여기서는 daily_base × 28일 × 현재기간 성장팩터(1.15)로 근사
  function calcBurnRate(productId, channel, shade, reviewCount) {
    const dailyBase = (reviewCount * SCALE) / 90;
    // 현재기간(D-28 ~ D-1) 평균 팩터 근사
    const avgFactor = channel === 'offline' ? 1.15 : 1.10;
    const monthly = dailyBase * avgFactor * 28;
    return Math.max(1, Math.round(monthly / 30));
  }

  const seedInventoryForProduct = (productId, demandByChannel, ddayTiers) => {
    // 쉐이드별 합산 burn_rate 계산 (모든 채널 합산)
    const shadeBurnRate = {};
    const shadeHasSales = new Set();

    for (const [channel, rawShadeMap] of Object.entries(demandByChannel)) {
      const shadeMap = mergeShadeMap(rawShadeMap);
      for (const [shade, cnt] of Object.entries(shadeMap)) {
        if (!ALL_SHADES.includes(shade)) continue;
        shadeBurnRate[shade] = (shadeBurnRate[shade] || 0) + calcBurnRate(productId, channel, shade, cnt);
        shadeHasSales.add(shade);
      }
    }

    for (const shade of ALL_SHADES) {
      let inboundQty;
      if (shadeHasSales.has(shade)) {
        const burn = shadeBurnRate[shade] || 1;
        const targetDays = (ddayTiers && ddayTiers[shade]) || 60;
        inboundQty = Math.max(50, Math.round(burn * targetDays));
      } else {
        // 판매 없는 쉐이드: 악성재고 시나리오
        // 어두울수록 더 많이 쌓여 있는 시나리오
        const darkShades = ['40N','43N','45N','45W','47N','51N','55N'];
        inboundQty = darkShades.includes(shade) ? 8000 : 3500;
      }

      rows.push({
        product_id:   productId,
        shade_code:   shade,
        country:      'KOR',
        txn_type:     'INBOUND',
        quantity:     inboundQty,
        txn_date:     inboundDate,
        po_reference: `KOR-PO-2026-${productId.toUpperCase()}`,
        notes:        shadeHasSales.has(shade)
          ? `D-${(ddayTiers && ddayTiers[shade]) || 60} 시나리오 발주`
          : '수요 미확인 재고 (악성재고 후보)',
      });
    }
  };

  seedInventoryForProduct('red',     DEMAND_KOR.red,     DDAY_TIERS.red);
  seedInventoryForProduct('ai',      DEMAND_KOR.ai,      DDAY_TIERS.ai);
  seedInventoryForProduct('ruby',    RUBY_DEMAND,        null);
  seedInventoryForProduct('crystal', CRYSTAL_DEMAND,     null);

  console.log(`  총 ${rows.length.toLocaleString()}개 행 생성`);
  await insertBatch('inventory_ledger', rows);
  console.log('  ✅ inventory_ledger 완료');
}

// ── STEP 4: customer_segment ──────────────────────────────────────────────────
async function seedCustomerSegments() {
  console.log('\n[STEP 4] KOR customer_segment 적재');
  const snapshotDate = toISO(addDays(TODAY, -1));
  const SEGMENT_KOR = {
    red:     { VIP:2200, AT_RISK:680, NEW_VIRAL:2400, femalePct:90, age:'여성, 20-29세' },
    ai:      { VIP:1500, AT_RISK:520, NEW_VIRAL:3100, femalePct:88, age:'여성, 18-28세' },
    ruby:    { VIP:1200, AT_RISK:400, NEW_VIRAL:1600, femalePct:87, age:'여성, 22-35세' },
    crystal: { VIP:950,  AT_RISK:310, NEW_VIRAL:1250, femalePct:89, age:'여성, 20-32세' },
  };
  const rows = [];
  for (const [prodId, seg] of Object.entries(SEGMENT_KOR)) {
    for (const segType of ['VIP','AT_RISK','NEW_VIRAL']) {
      rows.push({
        product_id:     prodId, country:'KOR', segment_type:segType,
        customer_count: seg[segType],
        female_pct:     seg.femalePct, peak_age_range:seg.age,
        snapshot_date:  snapshotDate,
      });
    }
  }
  await insertBatch('customer_segment', rows);
  console.log('  ✅ customer_segment 완료');
}

// ── STEP 5: 검증 ──────────────────────────────────────────────────────────────
async function verify() {
  console.log('\n[STEP 5] 결과 검증 (RPC 호출)');
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscnhkcGJzemhyaXJya21wZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTYzNjYsImV4cCI6MjA4OTI5MjM2Nn0.w-7_K3VXEN0v8Uik9Ei5WqRcrUjjaHQ3FjCl1ifJD_0';

  for (const [prod, label] of [['red','레드쿠션'],['ai','AI쿠션']]) {
    const body = JSON.stringify({p_product_id:prod, p_countries:['KOR']});
    const raw = await request('POST', '/rest/v1/rpc/get_dashboard_metrics', JSON.parse(body));
    // raw is already string from request(), need re-parse
    const r = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    const si = r.shade_intensity || {};
    const shadesWithData = Object.keys(si).length;
    const top3 = Object.entries(si).sort(([,a],[,b])=>b-a).slice(0,3);
    const inv  = r.inventory || [];
    const dead = r.dead_stock || [];

    console.log(`\n  📊 ${label} (KOR)`);
    console.log(`     쉐이드 히트맵 커버리지: ${shadesWithData}개 쉐이드`);
    console.log(`     Top3: ${top3.map(([s,i])=>`${s}(${i})`).join(' → ')}`);
    console.log(`     재고 알림 D-Day:`);
    inv.forEach(i => console.log(`       ${i.shade}: ${i.stock}개 재고 / ${i.burnRate}/일 → D-${Math.round(i.stock/i.burnRate)}`));
    console.log(`     악성재고: ${dead.map(d=>`${d.shade}(${d.months}개월)`).join(', ')}`);
    const vel = r.velocity || [];
    if (vel.length) {
      console.log(`     소진속도 amazon 주간: ${vel.map(v=>v.amazon).join(' → ')}`);
      console.log(`     소진속도 offline 주간: ${vel.map(v=>v.offline).join(' → ')}`);
    }
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('='.repeat(62));
  console.log('TIRTIR KOR 비즈니스 시나리오 데이터 적재 v2');
  console.log('='.repeat(62));
  try {
    await deleteKorData();
    await seedSalesOrders();
    await seedInventory();
    await seedCustomerSegments();
    await verify();

    console.log('\n' + '='.repeat(62));
    console.log('✅ 완료! 대시보드 확인 포인트:');
    console.log('  🎨 히트맵: 38개+ 쉐이드 색상 표시');
    console.log('  📈 소진속도: 요일효과 + 올영 프로모 스파이크 파형');
    console.log('  🚨 재고알림: 21N/17C → D-14 (긴급 항공 발주 필요)');
    console.log('  ☠️  악성재고: 어두운 쉐이드 (40N~55N)');
    console.log('='.repeat(62));
  } catch(e) {
    console.error('\n❌ 오류:', e.message);
    process.exit(1);
  }
})();
