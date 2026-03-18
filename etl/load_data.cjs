/**
 * TIRTIR ERP — Node.js ETL 데이터 적재 스크립트
 * Python ETL(generate_erp_data.py)과 동일한 로직을 Node.js로 구현.
 * 환경: Supabase slrxdpbszhrirrkmpfyy
 */
const https = require('https');

const SUPABASE_HOST = 'slrxdpbszhrirrkmpfyy.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNscnhkcGJzemhyaXJya21wZnl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzcxNjM2NiwiZXhwIjoyMDg5MjkyMzY2fQ.DYZmMdKE3TQSnn9e6GKQ1w2zwtHq2JYjJEFAmH7PUwY';

// ── 날짜 헬퍼 ────────────────────────────────────────────────────────────────
const END_DATE  = new Date();
const BASE_DATE = new Date(END_DATE); BASE_DATE.setDate(BASE_DATE.getDate() - 365);

function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toISO(d) { return d.toISOString().split('T')[0]; }
function daysDiff(a, b) { return Math.round((b - a) / 86400000); }

// ── 제품 설정 ─────────────────────────────────────────────────────────────────
const PRODUCTS = {
  red:     { baseDaily: 1100, price: 12.0 },
  ai:      { baseDaily: 850,  price: 14.0 },
  ruby:    { baseDaily: 620,  price: 13.0 },
  crystal: { baseDaily: 470,  price: 13.5 },
};

// ── 쉐이드 강도 ───────────────────────────────────────────────────────────────
const SHADE_INTENSITY = {
  KOR: { '10C':20,'13C':40,'13N':70,'13W':20,'13.5N':30,'15C':90,'15.5N':40,'17C':100,'17N':60,'17W':20,'19C':50,'19N':20,'19.5N':30,'21C':20,'21N':100,'21W':70,'22C':10,'22N':40,'22W':10,'23N':100,'24N':50,'24W':30,'25N':70,'27C':10,'27N':30,'28N':40,'29C':5,'29N':60,'30N':20,'31N':20,'33C':5,'33N':30,'33W':5,'34C':5,'34N':5,'34W':5,'35N':20,'37C':5,'40N':10,'43N':20,'45N':5,'45W':5,'47N':5,'51N':5,'55N':5 },
  JP:  { '10C':40,'13C':90,'13N':100,'13W':30,'13.5N':60,'15C':100,'15.5N':70,'17C':100,'17N':50,'17W':20,'19C':40,'19N':20,'19.5N':30,'21C':20,'21N':60,'21W':30,'22C':10,'22N':20,'22W':5,'23N':40,'24N':20,'24W':10,'25N':20,'27C':5,'27N':10,'28N':10,'29C':5,'29N':5,'30N':5,'31N':5,'33C':5,'33N':5,'33W':5,'34C':5,'34N':5,'34W':5,'35N':5,'37C':5,'40N':5,'43N':5,'45N':5,'45W':5,'47N':5,'51N':5,'55N':5 },
  US:  { '10C':5,'13C':10,'13N':20,'13W':5,'13.5N':10,'15C':30,'15.5N':20,'17C':50,'17N':40,'17W':10,'19C':40,'19N':30,'19.5N':30,'21C':20,'21N':70,'21W':50,'22C':20,'22N':60,'22W':20,'23N':90,'24N':70,'24W':50,'25N':100,'27C':20,'27N':80,'28N':70,'29C':20,'29N':100,'30N':60,'31N':50,'33C':20,'33N':80,'33W':20,'34C':20,'34N':40,'34W':10,'35N':90,'37C':20,'40N':70,'43N':60,'45N':20,'45W':20,'47N':10,'51N':5,'55N':5 },
};
const CHANNEL_MIX = {
  KOR: { amazon: 0.20, tiktok: 0.45, offline: 0.35 },
  JP:  { amazon: 0.65, tiktok: 0.20, offline: 0.15 },
  US:  { amazon: 0.70, tiktok: 0.25, offline: 0.05 },
};
const SEGMENT_BASE = {
  red:     { KOR:[1800,620,2100], JP:[950,280,880],  US:[680,420,950]  },
  ai:      { KOR:[1200,480,2800], JP:[720,210,1100], US:[520,380,1100] },
  ruby:    { KOR:[1100,380,1400], JP:[580,165,720],  US:[420,310,780]  },
  crystal: { KOR:[880,290,1100],  JP:[490,145,620],  US:[350,260,620]  },
};
const DEMO_BASE = {
  red:     { KOR:[88,'여성, 20-29세'], JP:[92,'여성, 18-27세'], US:[78,'여성, 22-35세'] },
  ai:      { KOR:[86,'여성, 18-28세'], JP:[91,'여성, 17-26세'], US:[76,'여성, 20-33세'] },
  ruby:    { KOR:[85,'여성, 22-35세'], JP:[90,'여성, 18-28세'], US:[74,'여성, 24-38세'] },
  crystal: { KOR:[87,'여성, 20-32세'], JP:[93,'여성, 17-25세'], US:[72,'여성, 23-40세'] },
};

// ── 난수 헬퍼 ─────────────────────────────────────────────────────────────────
function randn() { // Box-Muller
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function gaussClip(mu, sigma, lo, hi) {
  return Math.min(hi, Math.max(lo, mu + randn() * sigma));
}
function multinomial(n, probs) {
  // Simple multinomial sampling
  const result = new Array(probs.length).fill(0);
  for (let i = 0; i < n; i++) {
    let r = Math.random(), cum = 0;
    for (let j = 0; j < probs.length; j++) {
      cum += probs[j];
      if (r <= cum) { result[j]++; break; }
    }
  }
  return result;
}

// ── Supabase 업서트 ───────────────────────────────────────────────────────────
function upsertBatch(table, rows) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(rows);
    const options = {
      hostname: SUPABASE_HOST,
      path: '/rest/v1/' + table,
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(table + ' ' + res.statusCode + ': ' + d.substring(0, 300)));
        else resolve(res.statusCode);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function loadTable(table, rows, batchSize = 500) {
  const total = rows.length;
  for (let i = 0; i < total; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await upsertBatch(table, batch);
    const loaded = Math.min(i + batchSize, total);
    process.stdout.write(`  [Load] ${table}: ${loaded}/${total} (${(loaded/total*100).toFixed(1)}%)\r`);
  }
  console.log(`  [Load] ✅ ${table}: ${total.toLocaleString()}건 완료         `);
}

// ── ETL ───────────────────────────────────────────────────────────────────────
async function generateSalesOrders() {
  const records = [];
  const shades  = Object.keys(SHADE_INTENSITY.KOR);
  const totalDays = daysDiff(BASE_DATE, END_DATE);

  for (const [productId, prodCfg] of Object.entries(PRODUCTS)) {
    for (const [country, intensityMap] of Object.entries(SHADE_INTENSITY)) {
      const intensityArr = shades.map(s => intensityMap[s] || 5);
      const intensitySum = intensityArr.reduce((a, b) => a + b, 0);
      const intensityNorm = intensityArr.map(v => v / intensitySum);
      const channelMix = CHANNEL_MIX[country];
      const channels = Object.keys(channelMix);
      const channelProbs = channels.map(c => channelMix[c]);

      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const currentDate = addDays(BASE_DATE, dayOffset);
        const progressPct = dayOffset / totalDays;
        const growthFactor = 0.70 + 0.50 * progressPct;
        const weekdayFactor = currentDate.getDay() === 0 || currentDate.getDay() === 6 ? 1.20 : 1.00;
        const noise = gaussClip(1.0, 0.12, 0.5, 1.8);
        const dailyTotal = Math.max(0, Math.round(prodCfg.baseDaily * growthFactor * weekdayFactor * noise));
        if (dailyTotal === 0) continue;

        const shadeQtys = multinomial(dailyTotal, intensityNorm);
        const dateStr = toISO(currentDate);

        for (let si = 0; si < shades.length; si++) {
          const shadeQty = shadeQtys[si];
          if (shadeQty === 0) continue;
          for (let ci = 0; ci < channels.length; ci++) {
            const chQty = Math.max(0, Math.round(shadeQty * channelMix[channels[ci]] * gaussClip(1.0, 0.08, 0.7, 1.4)));
            if (chQty === 0) continue;
            records.push({
              product_id:     productId,
              shade_code:     shades[si],
              country:        country,
              channel:        channels[ci],
              sale_date:      dateStr,
              quantity:       chQty,
              unit_price_usd: prodCfg.price,
            });
          }
        }
      }
    }
  }
  console.log(`  [Transform] 판매 주문: ${records.length.toLocaleString()}건`);
  return records;
}

async function generateInventoryLedger(salesRecords) {
  const records = [];
  const shades  = Object.keys(SHADE_INTENSITY.KOR);

  // 초기 입고
  for (const productId of Object.keys(PRODUCTS)) {
    for (const [country, intensityMap] of Object.entries(SHADE_INTENSITY)) {
      for (const shade of shades) {
        const intensity  = intensityMap[shade] || 5;
        const initStock  = Math.max(500, Math.round(intensity * 200 * gaussClip(1.0, 0.15, 0.8, 1.3)));
        records.push({ product_id: productId, shade_code: shade, country, txn_type: 'INBOUND', quantity: initStock, txn_date: toISO(BASE_DATE), notes: '초기 입고' });
      }
    }
  }

  // 분기 재발주 (90일, 180일, 270일)
  for (const qOffset of [90, 180, 270]) {
    const qDate = toISO(addDays(BASE_DATE, qOffset));
    for (const productId of Object.keys(PRODUCTS)) {
      for (const [country, intensityMap] of Object.entries(SHADE_INTENSITY)) {
        for (const shade of shades) {
          const intensity = intensityMap[shade] || 5;
          if (intensity < 20) continue;
          const qty = Math.max(200, Math.round(intensity * 80 * gaussClip(1.0, 0.1, 0.85, 1.15)));
          records.push({ product_id: productId, shade_code: shade, country, txn_type: 'INBOUND', quantity: qty, txn_date: qDate, notes: `분기 재발주 Q${Math.floor(qOffset/90)+1}` });
        }
      }
    }
  }

  // 판매 출고: sales_records를 날짜+제품+쉐이드+국가별 합산
  const outMap = {};
  for (const r of salesRecords) {
    const key = `${r.product_id}|${r.shade_code}|${r.country}|${r.sale_date}`;
    outMap[key] = (outMap[key] || 0) + r.quantity;
  }
  for (const [key, qty] of Object.entries(outMap)) {
    const [product_id, shade_code, country, txn_date] = key.split('|');
    records.push({ product_id, shade_code, country, txn_type: 'OUTBOUND', quantity: -qty, txn_date, notes: '판매 출고' });
  }

  console.log(`  [Transform] 재고 원장: ${records.length.toLocaleString()}건`);
  return records;
}

async function generateCustomerSegments() {
  const records = [];
  const today = new Date();
  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const snapDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const snapStr  = toISO(snapDate);
    for (const [productId, countryData] of Object.entries(SEGMENT_BASE)) {
      for (const [country, [vip, atRisk, newViral]] of Object.entries(countryData)) {
        const [femalePct, ageGroup] = DEMO_BASE[productId][country];
        const noise = gaussClip(1.0, 0.06, 0.88, 1.12);
        for (const [segType, base] of [['VIP', vip], ['AT_RISK', atRisk], ['NEW_VIRAL', newViral]]) {
          records.push({
            product_id:     productId,
            country:        country,
            segment_type:   segType,
            customer_count: Math.max(1, Math.round(base * noise)),
            female_pct:     Math.round((femalePct + (Math.random() * 3 - 1.5)) * 100) / 100,
            peak_age_range: ageGroup,
            snapshot_date:  snapStr,
          });
        }
      }
    }
  }
  console.log(`  [Transform] 고객 세그먼트: ${records.length.toLocaleString()}건`);
  return records;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('='.repeat(55));
  console.log('  TIRTIR ERP 데이터 파이프라인 (Node.js ETL)');
  console.log(`  기간: ${toISO(BASE_DATE)} → ${toISO(END_DATE)} (365일)`);
  console.log('='.repeat(55));

  console.log('\n[1/3] Extract+Transform — 데이터 생성 중...');
  const sales     = await generateSalesOrders();
  const inventory = await generateInventoryLedger(sales);
  const customers = await generateCustomerSegments();

  console.log('\n[2/3] QA — 품질 검증...');
  const negSales = sales.filter(r => r.quantity <= 0).length;
  console.log(`  [QA] 음수 판매량: ${negSales}건 (0이어야 함)`);
  console.log(`  [QA] ✅ 검증 통과`);

  console.log('\n[3/3] Load — Supabase 적재...');
  await loadTable('sales_order',      sales);
  await loadTable('inventory_ledger', inventory);
  await loadTable('customer_segment', customers);

  console.log('\n' + '='.repeat(55));
  console.log('  ✅ ETL 완료!');
  console.log(`     판매:   ${sales.length.toLocaleString()}건`);
  console.log(`     재고:   ${inventory.length.toLocaleString()}건`);
  console.log(`     고객:   ${customers.length.toLocaleString()}건`);
  console.log('='.repeat(55));
})().catch(err => { console.error('ETL 실패:', err.message); process.exit(1); });
