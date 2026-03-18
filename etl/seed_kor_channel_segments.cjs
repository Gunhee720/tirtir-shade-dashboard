'use strict';
/**
 * KOR 채널별 customer_segment 적재
 * ─────────────────────────────────────────────────────
 * peak_age_range 인코딩 방식: "channel|실제연령대"
 *   - "offline|여성, 25-34세"  → 올리브영 전용 세그먼트
 *   - "amazon|여성, 18-27세"   → 자사몰 전용 세그먼트
 *
 * snapshot_date 구분:
 *   - 채널별: 2026-01-15 (amazon), 2026-01-16 (offline)
 *   - ALL:    TODAY-1 (RPC MAX 쿼리가 항상 이 값을 선택)
 */
const https = require('https');

const SUPABASE_HOST = 'slrxdpbszhrirrkmpfyy.supabase.co';
const SERVICE_KEY   =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscnhkcGJzemhyaXJya21wZnl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcxNjM2NiwiZXhwIjoyMDg5MjkyMzY2fQ.DYZmMdKE3TQSnn9e6GKQ1w2zwtHq2JYjJEFAmH7PUwY';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: SUPABASE_HOST, path, method,
      headers: {
        'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal,resolution=merge-duplicates',
        ...(data ? {'Content-Length': Buffer.byteLength(data)} : {}),
      },
    };
    const req = https.request(opts, res => {
      let buf = ''; res.on('data', c => buf += c);
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

async function insertBatch(table, rows) {
  await request('POST', `/rest/v1/${table}`, rows);
  console.log(`  ✅ ${table}: ${rows.length}개 행 삽입`);
}

// ── 채널별 고객 세그먼트 설계 ─────────────────────────────────────────────────
//
// 올리브영 (offline): 오프라인 뷰티숍 고객
//   - VIP 비중 높음 (자주 방문하는 단골), 연령대 살짝 높음
//   - NEW_VIRAL은 적음 (오프라인은 바이럴 신규 유입 제한적)
//
// 자사몰 (amazon): 브랜드 공식몰
//   - NEW_VIRAL 압도적으로 많음 (SNS 광고 → 공홈 직구 패턴)
//   - VIP는 소수 정예 (재구매 브랜드 충성 고객)
//   - 연령대 낮음 (MZ세대 디지털 네이티브)
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_SEGMENTS = {
  red: {
    offline: {
      VIP:       1450,
      AT_RISK:   680,
      NEW_VIRAL: 1380,
      femalePct: 91,
      age:       '여성, 25-34세',
    },
    amazon: {
      VIP:       285,
      AT_RISK:   148,
      NEW_VIRAL: 3920,
      femalePct: 82,
      age:       '여성, 18-27세',
    },
  },
  ai: {
    offline: {
      VIP:       2180,
      AT_RISK:   740,
      NEW_VIRAL: 1820,
      femalePct: 93,
      age:       '여성, 22-32세',
    },
    amazon: {
      VIP:       360,
      AT_RISK:   225,
      NEW_VIRAL: 5480,
      femalePct: 85,
      age:       '여성, 18-25세',
    },
  },
  ruby: {
    offline: {
      VIP:       980,
      AT_RISK:   390,
      NEW_VIRAL: 840,
      femalePct: 89,
      age:       '여성, 25-35세',
    },
    amazon: {
      VIP:       125,
      AT_RISK:   72,
      NEW_VIRAL: 1650,
      femalePct: 80,
      age:       '여성, 20-28세',
    },
  },
  crystal: {
    offline: {
      VIP:       780,
      AT_RISK:   295,
      NEW_VIRAL: 680,
      femalePct: 91,
      age:       '여성, 23-33세',
    },
    amazon: {
      VIP:       95,
      AT_RISK:   58,
      NEW_VIRAL: 1280,
      femalePct: 82,
      age:       '여성, 19-26세',
    },
  },
};

// snapshot_date 컨벤션:
//   채널별 데이터는 과거 고정 날짜 사용 → RPC의 MAX(snapshot_date) 쿼리가 ALL 데이터를 선택
const DATE_AMAZON  = '2026-01-15';
const DATE_OFFLINE = '2026-01-16';
const CH_DATES     = { amazon: DATE_AMAZON, offline: DATE_OFFLINE };

async function main() {
  console.log('='.repeat(62));
  console.log('TIRTIR KOR 채널별 customer_segment 적재');
  console.log('='.repeat(62));

  // ① 기존 채널 인코딩 데이터 삭제 (peak_age_range에 '|'가 포함된 행)
  console.log('\n[STEP 1] 기존 채널별 세그먼트 삭제');
  // PostgREST LIKE 필터로 "offline|%" 또는 "amazon|%" 패턴 삭제
  await request('DELETE', '/rest/v1/customer_segment?country=eq.KOR&snapshot_date=in.(2026-01-15,2026-01-16)');
  console.log('  ✅ 삭제 완료');

  // ② 채널별 고객 세그먼트 삽입
  console.log('\n[STEP 2] 채널별 고객 세그먼트 삽입');
  const rows = [];

  for (const [prodId, channels] of Object.entries(CHANNEL_SEGMENTS)) {
    for (const [channel, seg] of Object.entries(channels)) {
      const snapshotDate = CH_DATES[channel];
      for (const segType of ['VIP', 'AT_RISK', 'NEW_VIRAL']) {
        rows.push({
          product_id:     prodId,
          country:        'KOR',
          segment_type:   segType,
          customer_count: seg[segType],
          female_pct:     seg.femalePct,
          // 인코딩: "channel|연령대" — 프론트엔드가 split('|')[1]로 연령대 추출
          peak_age_range: `${channel}|${seg.age}`,
          snapshot_date:  snapshotDate,
        });
      }
    }
  }

  await insertBatch('customer_segment', rows);

  // ③ 확인
  console.log('\n[STEP 3] 적재 결과 확인');
  const verifyPath = '/rest/v1/customer_segment?country=eq.KOR&select=product_id,segment_type,customer_count,female_pct,peak_age_range,snapshot_date&order=product_id,snapshot_date,segment_type';
  const raw = await request('GET', verifyPath);
  const data = JSON.parse(raw);

  console.log(`\n  총 ${data.length}개 행`);
  const grouped = {};
  data.forEach(r => {
    const key = `${r.product_id} [${r.peak_age_range.split('|')[0]}]`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(`${r.segment_type}:${r.customer_count}`);
  });
  for (const [grp, items] of Object.entries(grouped)) {
    console.log(`  ${grp}: ${items.join(', ')}`);
  }

  console.log('\n' + '='.repeat(62));
  console.log('✅ 완료! 채널 선택 시 다른 고객 세그먼트 표시');
  console.log('  자사몰: NEW_VIRAL 압도적 (SNS 유입)');
  console.log('  올리브영: VIP 비중 높음 (오프라인 충성 고객)');
  console.log('='.repeat(62));
}

main().catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
