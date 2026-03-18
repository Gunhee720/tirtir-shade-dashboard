<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TIRTIR Shade-Sync — 글로벌 쿠션 재고·판매 인텔리전스 대시보드

**실무 ERP 구조**를 모사한 정규화 DB 설계 + Python ETL 파이프라인 + 고급 SQL 분석 쿼리로 구성된 포트폴리오 프로젝트입니다.

---

## 1. ERP ERD (개체-관계 모델)

단일 테이블이 아닌 실무 ERP 환경을 모사하여 **5개의 핵심 테이블**로 분리 설계했습니다.

```
┌──────────────────┐         ┌──────────────────┐
│  product_master  │         │  shade_master     │
│  ──────────────  │         │  ──────────────   │
│ PK product_id    │         │ PK shade_code     │
│    product_name  │         │    shade_name     │
│    product_line  │         │    undertone C/N/W│
│    sku_code      │         │    shade_number   │
│    launch_date   │         │    depth_class ★  │  ← Generated Column
│    base_price_usd│         └────────┬─────────┘
└────────┬─────────┘                  │
         │ 1                          │ 1
         │ N                          │ N
┌────────┴────────────────────────────┴────────────────┐
│                    sales_order                        │
│  ──────────────────────────────────────────────────  │
│ PK order_id (BIGSERIAL)                               │
│ FK product_id  →  product_master                      │
│ FK shade_code  →  shade_master                        │
│    country     CHECK IN ('KOR','JP','US')              │
│    channel     CHECK IN ('amazon','tiktok','offline') │
│    sale_date / quantity / unit_price_usd               │
└────────┬───────────────────────────────────────┬──────┘
         │ 1                                     │ 1
         │ N                                     │ N
┌────────┴────────────────┐  ┌────────────────────┴──────────┐
│   inventory_ledger      │  │   customer_segment            │
│  ──────────────────     │  │  ──────────────────────────   │
│ PK ledger_id            │  │ PK segment_id                 │
│ FK product_id           │  │ FK product_id                 │
│ FK shade_code           │  │    country                    │
│    country              │  │    segment_type               │
│    txn_type             │  │    VIP / AT_RISK / NEW_VIRAL  │
│    INBOUND(+)/OUTBOUND(-│  │    customer_count             │
│    txn_date / notes     │  │    female_pct                 │
│                         │  │    snapshot_date              │
│  → SUM = 현재 재고      │  │  → 월별 스냅샷 히스토리       │
└─────────────────────────┘  └───────────────────────────────┘
```

| 설계 포인트 | 내용 |
|-------------|------|
| **정규화 (3NF)** | 제품/쉐이드 마스터 분리 → 데이터 중복 제거, 참조 무결성 보장 |
| **복식 기장 재고** | INBOUND(+) / OUTBOUND(−) 누적 합계로 현재 재고 계산 → 감사 추적 가능 |
| **Generated Column** | `depth_class`를 `shade_number` 기반으로 DB가 자동 계산 (유지보수 비용 0) |
| **RLS 정책** | Row Level Security로 사용자별 데이터 격리 |
| **복합 인덱스** | 대시보드 핵심 쿼리 패턴에 최적화된 인덱스 3개 |

---

## 2. Python ETL 파이프라인

`etl/generate_erp_data.py` — 실무 ERP 일일 배치(Daily Batch) 프로세스를 모사합니다.

```
[Extract]   가상 ERP 파라미터 정의
            ├── 4개 제품 × 3개 국가 × 46개 쉐이드 × 3개 채널
            └── 국가별 쉐이드 강도 분포 / 채널 믹스(KOR=틱톡, JP·US=아마존)

[Transform] Pandas + NumPy 데이터 생성
            ├── sales_order      : 365일 × Multinomial 분포 (성장 트렌드 + 주말 계절성 + 노이즈)
            ├── inventory_ledger : INBOUND 초기입고 + 분기 재발주 + OUTBOUND 판매 출고
            └── customer_segment : RFM 기반 VIP/AT_RISK/NEW_VIRAL 월별 스냅샷 (12개월)

[Load]      Supabase PostgREST REST API 배치 업서트
            └── POST /rest/v1/{table}  |  Prefer: resolution=merge-duplicates
```

```bash
pip install -r etl/requirements.txt
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."
python etl/generate_erp_data.py
```

---

## 3. 고급 SQL 쿼리 (`db/queries/dashboard_queries.sql`)

| # | 쿼리명 | 핵심 기법 |
|---|--------|-----------|
| 1 | 30일 이동 평균 소진율 (Burn Rate) | `AVG() OVER (ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)` |
| 2 | RFM 고객 세분화 스코어 | CTE 3단 체인 + `NTILE(5)` 5분위 분류 |
| 3 | D-Day 재고 소진 예측 | CTE 조인 + `stock / burn_rate` 산술 계산 |
| 4 | 악성 재고 자동 탐지 | `NOT EXISTS` 상관 서브쿼리 |
| 5 | 채널별 쉐이드 기여도 분석 | `SUM() FILTER (WHERE channel=...)` + 비율 계산 |

### RPC 함수 (`db/migrations/003_rpc_functions.sql`)

`get_dashboard_metrics(p_product_id TEXT, p_countries TEXT[])` — CTE 8단계로 대시보드 전체 지표를 단일 JSONB로 반환합니다 (N+1 쿼리 방지).

```sql
-- 호출 예시
SELECT get_dashboard_metrics('red', ARRAY['KOR', 'JP']);
```

```
CTE 체인:
  ① current_sales    → 현재 기간 총 매출 (USD)
  ② prev_sales       → MoM 비교용 전기 매출
  ③ weekly_channel   → FLOOR 나눗셈으로 주간 구간 분류
  ④ velocity_pivot   → FILTER 절로 채널 PIVOT (amazon/tiktok/offline)
  ⑤ shade_intensity  → MAX() OVER() 윈도우 함수로 상대 강도 0-100 정규화
  ⑥ inventory_ranked → 복식기장 SUM + ROW_NUMBER() D-Day 긴급도 정렬
  ⑦ dead_stock       → 서브쿼리로 마지막 판매일 조회 → 90일 초과 탐지
  ⑧ customer_agg     → FILTER 조건부 집계 + 최빈 연령대 서브쿼리
```

---

## 4. 시스템 아키텍처

```
Supabase PostgreSQL
  ├── 5개 정규화 테이블 (ERD 참조)
  ├── RLS 정책 (읽기 전용)
  └── RPC 함수: get_dashboard_metrics()
        ↑
        │ PostgREST REST API (native fetch, SDK 불필요)
        ↓
src/lib/supabase.ts            ← RPC 클라이언트 + 타입 변환
src/hooks/useDashboardData.ts  ← DB live / mock 자동 전환
        ↓
src/App.tsx                    ← 필터 상태 → 훅 → 대시보드 렌더링

헤더 배지: ● LIVE DB  (Supabase 연결 시)
           ● MOCK DATA (미연결 시, mockData.ts 사용)
```

---

## 5. 로컬 실행

```bash
npm install
npm run dev       # http://localhost:3000
```

Supabase 연동 시:
```bash
cp .env.example .env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 설정 후 재시작
# DB 초기화: db/migrations/ 순서대로 Supabase SQL Editor에서 실행
# 데이터 적재: python etl/generate_erp_data.py
```

---

## 6. 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| 시각화 | Recharts 3.8, Lucide React |
| DB | Supabase (PostgreSQL 15+), PostgREST RPC |
| ETL | Python 3.11, Pandas 2.2, NumPy 1.26 |
