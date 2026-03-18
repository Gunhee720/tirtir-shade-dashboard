#!/usr/bin/env python3
"""
TIRTIR Cosmetics ERP — 데이터 파이프라인
=========================================
ETL(Extract → Transform → Load) 파이프라인:
  - Extract  : 가상 ERP 파라미터에서 일별 트랜잭션 구조 정의
  - Transform: Pandas로 판매/재고/고객 데이터 생성 및 정제
  - Load     : Supabase REST API (PostgREST)로 배치 업서트

실무 배경:
  실제 ERP에서는 POS·이커머스 시스템에서 일일 마감(Daily Batch) 처리를 통해
  판매 원장(Sales Ledger)과 재고 원장(Inventory Ledger)이 갱신됩니다.
  이 스크립트는 그 배치 프로세스를 모사하여 대시보드 DB를 초기화합니다.

사용법:
  $ pip install -r requirements.txt
  $ export SUPABASE_URL="https://your-project.supabase.co"
  $ export SUPABASE_SERVICE_KEY="eyJ..."   # service_role key (쓰기 권한)
  $ python generate_erp_data.py
"""

import os
import random
import time
from datetime import date, timedelta
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

# ── 환경 변수 ─────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")   # service_role 키
HEADERS = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Prefer": "resolution=merge-duplicates",   # ON CONFLICT DO UPDATE
}

# ── 분석 기간: 최근 365일 ─────────────────────────────────────────────────────
END_DATE   = date.today()
BASE_DATE  = END_DATE - timedelta(days=365)

# ── 제품 마스터 (product_master와 동기화) ─────────────────────────────────────
PRODUCTS: Dict[str, Dict] = {
    "red":     {"base_daily": 1100, "price": 12.0},
    "ai":      {"base_daily": 850,  "price": 14.0},
    "ruby":    {"base_daily": 620,  "price": 13.0},
    "crystal": {"base_daily": 470,  "price": 13.5},
}

# ── 국가별 쉐이드 판매 강도 (shade_master 코드 기준, 0-100) ──────────────────
SHADE_INTENSITY: Dict[str, Dict[str, int]] = {
    "KOR": {
        "10C":5,  "13C":20, "13N":70, "13W":20, "13.5N":30,
        "15C":90, "15.5N":40,"17C":100,"17N":60, "17W":20,
        "19C":50, "19N":20, "19.5N":30,"21C":20, "21N":100,
        "21W":70, "22C":10, "22N":40, "22W":10, "23N":100,
        "24N":50, "24W":30, "25N":70, "27C":10, "27N":30,
        "28N":40, "29C":5,  "29N":60, "30N":20, "31N":20,
        "33C":5,  "33N":30, "33W":5,  "34C":5,  "34N":5,
        "34W":5,  "35N":20, "37C":5,  "40N":10, "43N":20,
        "45N":5,  "45W":5,  "47N":5,  "51N":5,  "55N":5,
    },
    "JP": {
        "10C":40, "13C":90, "13N":100,"13W":30, "13.5N":60,
        "15C":100,"15.5N":70,"17C":100,"17N":50, "17W":20,
        "19C":40, "19N":20, "19.5N":30,"21C":20, "21N":60,
        "21W":30, "22C":10, "22N":20, "22W":5,  "23N":40,
        "24N":20, "24W":10, "25N":20, "27C":5,  "27N":10,
        "28N":10, "29C":5,  "29N":5,  "30N":5,  "31N":5,
        "33C":5,  "33N":5,  "33W":5,  "34C":5,  "34N":5,
        "34W":5,  "35N":5,  "37C":5,  "40N":5,  "43N":5,
        "45N":5,  "45W":5,  "47N":5,  "51N":5,  "55N":5,
    },
    "US": {
        "10C":5,  "13C":10, "13N":20, "13W":5,  "13.5N":10,
        "15C":30, "15.5N":20,"17C":50, "17N":40, "17W":10,
        "19C":40, "19N":30, "19.5N":30,"21C":20, "21N":70,
        "21W":50, "22C":20, "22N":60, "22W":20, "23N":90,
        "24N":70, "24W":50, "25N":100,"27C":20, "27N":80,
        "28N":70, "29C":20, "29N":100,"30N":60, "31N":50,
        "33C":20, "33N":80, "33W":20, "34C":20, "34N":40,
        "34W":10, "35N":90, "37C":20, "40N":70, "43N":60,
        "45N":20, "45W":20, "47N":10, "51N":5,  "55N":5,
    },
}

# ── 국가별 채널 믹스 (KOR=틱톡 강세, JP/US=아마존 강세) ──────────────────────
CHANNEL_MIX: Dict[str, Dict[str, float]] = {
    "KOR": {"amazon": 0.20, "tiktok": 0.45, "offline": 0.35},
    "JP":  {"amazon": 0.65, "tiktok": 0.20, "offline": 0.15},
    "US":  {"amazon": 0.70, "tiktok": 0.25, "offline": 0.05},
}

# ── 고객 세그먼트 기준값 (mockData 기반) ─────────────────────────────────────
SEGMENT_BASE: Dict[str, Dict[str, Tuple[int, int, int]]] = {
    "red":     {"KOR": (1800,620,2100), "JP": (950,280,880),  "US": (680,420,950)},
    "ai":      {"KOR": (1200,480,2800), "JP": (720,210,1100), "US": (520,380,1100)},
    "ruby":    {"KOR": (1100,380,1400), "JP": (580,165,720),  "US": (420,310,780)},
    "crystal": {"KOR": (880,290,1100),  "JP": (490,145,620),  "US": (350,260,620)},
}
DEMO_BASE: Dict[str, Dict[str, Tuple[float, str]]] = {
    "red":     {"KOR": (88.0,"여성, 20-29세"), "JP": (92.0,"여성, 18-27세"), "US": (78.0,"여성, 22-35세")},
    "ai":      {"KOR": (86.0,"여성, 18-28세"), "JP": (91.0,"여성, 17-26세"), "US": (76.0,"여성, 20-33세")},
    "ruby":    {"KOR": (85.0,"여성, 22-35세"), "JP": (90.0,"여성, 18-28세"), "US": (74.0,"여성, 24-38세")},
    "crystal": {"KOR": (87.0,"여성, 20-32세"), "JP": (93.0,"여성, 17-25세"), "US": (72.0,"여성, 23-40세")},
}


# =============================================================================
# STEP 1: EXTRACT — 가상 ERP 파라미터 정의 및 쉐이드 코드 추출
# =============================================================================
def extract_shade_codes() -> List[str]:
    """shade_master에 등록된 46개 쉐이드 코드 반환."""
    return list(SHADE_INTENSITY["KOR"].keys())


# =============================================================================
# STEP 2: TRANSFORM — 판매/재고/고객 데이터 생성
# =============================================================================
def transform_sales_orders() -> pd.DataFrame:
    """
    일별 판매 트랜잭션 생성.

    실무 ERP에서는 각 채널(Amazon/TikTok/오프라인 POS)의 API에서
    주문 데이터를 수집(Extract)하고, 쉐이드 코드 매핑·환율 적용 등의
    정제(Transform) 후 판매 원장에 기록합니다.

    여기서는 국가별 쉐이드 강도 분포를 기반으로
    365일치 일별 트랜잭션을 Multinomial 분포로 생성합니다.
    """
    rng        = np.random.default_rng(seed=42)   # 재현 가능성 확보
    shade_codes = extract_shade_codes()
    records: List[dict] = []
    total_days = (END_DATE - BASE_DATE).days

    for product_id, prod_cfg in PRODUCTS.items():
        for country, intensity_map in SHADE_INTENSITY.items():
            intensity_arr  = np.array([intensity_map[s] for s in shade_codes], dtype=float)
            intensity_norm = intensity_arr / intensity_arr.sum()   # 확률 정규화
            channel_mix    = CHANNEL_MIX[country]

            for day_offset in range(total_days):
                current_date = BASE_DATE + timedelta(days=day_offset)
                progress_pct = day_offset / total_days

                # 트렌드 요인: 초기 70% → 최대 120% (성장 곡선)
                growth_factor   = 0.70 + 0.50 * progress_pct
                # 계절성: 주말 20% 상승
                weekday_factor  = 1.20 if current_date.weekday() >= 5 else 1.00
                # 일별 노이즈 (정규분포 σ=0.12)
                noise           = float(rng.normal(1.0, 0.12))
                noise           = max(0.5, min(1.8, noise))   # 클리핑

                daily_total = int(
                    prod_cfg["base_daily"] * growth_factor * weekday_factor * noise
                )
                if daily_total <= 0:
                    continue

                # 쉐이드별 수량: Multinomial 분포
                shade_qtys = rng.multinomial(daily_total, intensity_norm)

                for shade_idx, shade_code in enumerate(shade_codes):
                    shade_qty = int(shade_qtys[shade_idx])
                    if shade_qty == 0:
                        continue

                    for channel, mix_pct in channel_mix.items():
                        ch_qty = int(
                            shade_qty * mix_pct * float(rng.normal(1.0, 0.08))
                        )
                        if ch_qty <= 0:
                            continue

                        records.append({
                            "product_id":     product_id,
                            "shade_code":     shade_code,
                            "country":        country,
                            "channel":        channel,
                            "sale_date":      current_date.isoformat(),
                            "quantity":       ch_qty,
                            "unit_price_usd": prod_cfg["price"],
                        })

    df = pd.DataFrame(records)
    # 음수 수량 방어 (채널 노이즈로 인한 예외 처리)
    df = df[df["quantity"] > 0].reset_index(drop=True)
    print(f"  [Transform] 판매 주문 생성: {len(df):,}건")
    return df


def transform_inventory_ledger(sales_df: pd.DataFrame) -> pd.DataFrame:
    """
    재고 원장 생성 (복식 기장 방식).

    INBOUND  : 분기별 발주 입고 (양수)
    OUTBOUND : 일별 판매 출고 (음수) — sales_order와 1:1 연동
    """
    shade_codes = extract_shade_codes()
    records: List[dict] = []

    # ── 초기 입고 (Base Date 기준 초기 재고 설정) ──────────────────────────────
    for product_id in PRODUCTS:
        for country, intensity_map in SHADE_INTENSITY.items():
            for shade_code in shade_codes:
                intensity    = intensity_map.get(shade_code, 5)
                # 강도 비례 초기 재고 (200 × 강도 ± 20% 노이즈)
                initial_stock = max(500, int(
                    intensity * 200 * random.uniform(0.8, 1.2)
                ))
                records.append({
                    "product_id": product_id,
                    "shade_code": shade_code,
                    "country":    country,
                    "txn_type":   "INBOUND",
                    "quantity":   initial_stock,
                    "txn_date":   BASE_DATE.isoformat(),
                    "po_reference": f"PO-{product_id.upper()}-{country}-INIT",
                    "notes":      "초기 입고 (Initial Stock Setup)",
                })

    # ── 분기 추가 입고 (Q2, Q3) ──────────────────────────────────────────────
    for quarter_offset in [90, 180, 270]:
        inbound_date = (BASE_DATE + timedelta(days=quarter_offset)).isoformat()
        for product_id in PRODUCTS:
            for country, intensity_map in SHADE_INTENSITY.items():
                for shade_code in shade_codes:
                    intensity    = intensity_map.get(shade_code, 5)
                    if intensity < 20:   # 저강도 쉐이드는 분기 발주 스킵
                        continue
                    reorder_qty  = max(200, int(intensity * 80 * random.uniform(0.9, 1.1)))
                    records.append({
                        "product_id":   product_id,
                        "shade_code":   shade_code,
                        "country":      country,
                        "txn_type":     "INBOUND",
                        "quantity":     reorder_qty,
                        "txn_date":     inbound_date,
                        "po_reference": f"PO-{product_id.upper()}-{country}-Q{quarter_offset//90+1}",
                        "notes":        f"분기 재발주 ({quarter_offset}일차)",
                    })

    # ── 판매 출고 (OUTBOUND): sales_order 일별 합계 → 음수 기록 ───────────────
    daily_totals = (
        sales_df
        .groupby(["product_id", "shade_code", "country", "sale_date"])["quantity"]
        .sum()
        .reset_index()
    )
    for _, row in daily_totals.iterrows():
        records.append({
            "product_id":   row["product_id"],
            "shade_code":   row["shade_code"],
            "country":      row["country"],
            "txn_type":     "OUTBOUND",
            "quantity":     -int(row["quantity"]),   # 출고 = 음수
            "txn_date":     row["sale_date"],
            "po_reference": None,
            "notes":        "판매 출고 (Daily Batch)",
        })

    df = pd.DataFrame(records)
    print(f"  [Transform] 재고 원장 생성: {len(df):,}건 (INBOUND+OUTBOUND)")
    return df


def transform_customer_segments() -> pd.DataFrame:
    """
    고객 세그먼트 월별 스냅샷 생성.

    실무에서는 CRM 시스템의 RFM 스코어링 배치 결과를
    월 1회 집계하여 세그먼트 히스토리 테이블에 적재합니다.
    """
    records: List[dict] = []

    for month_offset in range(12):   # 12개월 치 스냅샷
        snapshot_date = (
            END_DATE.replace(day=1) - timedelta(days=month_offset * 30)
        ).isoformat()

        for product_id, country_data in SEGMENT_BASE.items():
            for country, (vip, at_risk, new_viral) in country_data.items():
                female_pct, age_group = DEMO_BASE[product_id][country]
                noise = random.gauss(1.0, 0.06)

                for seg_type, base_count in [
                    ("VIP", vip), ("AT_RISK", at_risk), ("NEW_VIRAL", new_viral)
                ]:
                    records.append({
                        "product_id":     product_id,
                        "country":        country,
                        "segment_type":   seg_type,
                        "customer_count": max(1, int(base_count * noise)),
                        "female_pct":     round(
                            female_pct + random.uniform(-1.5, 1.5), 2
                        ),
                        "peak_age_range": age_group,
                        "snapshot_date":  snapshot_date,
                    })

    df = pd.DataFrame(records)
    print(f"  [Transform] 고객 세그먼트 스냅샷 생성: {len(df):,}건")
    return df


# =============================================================================
# STEP 3: LOAD — Supabase PostgREST API 배치 업서트
# =============================================================================
def load_to_supabase(table: str, df: pd.DataFrame, batch_size: int = 500) -> None:
    """
    Supabase PostgREST REST API를 통한 배치 업서트.

    엔드포인트: POST /rest/v1/{table}
    헤더 Prefer: resolution=merge-duplicates → ON CONFLICT DO UPDATE

    실무에서는 DB 커넥션 풀(pgBouncer) + 벌크 COPY 명령을 사용하지만,
    포트폴리오 환경(REST API)에서는 배치 크기를 조정하여 처리합니다.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"  [Load] SUPABASE 환경변수 미설정 — {table} 적재 건너뜀")
        return

    url   = f"{SUPABASE_URL}/rest/v1/{table}"
    total = len(df)

    for start in range(0, total, batch_size):
        batch = df.iloc[start : start + batch_size].to_dict(orient="records")
        resp  = requests.post(url, headers=HEADERS, json=batch, timeout=60)

        if resp.status_code not in (200, 201):
            raise RuntimeError(
                f"[Load] {table} 적재 실패 ({resp.status_code}): {resp.text[:300]}"
            )

        loaded = min(start + batch_size, total)
        print(f"  [Load] {table}: {loaded:,}/{total:,} ({loaded/total*100:.1f}%)",
              end="\r")
        time.sleep(0.05)   # API rate limit 방어

    print(f"  [Load] ✅ {table}: {total:,}건 완료")


# =============================================================================
# DATA QUALITY CHECKS
# =============================================================================
def validate(sales_df: pd.DataFrame, inventory_df: pd.DataFrame) -> None:
    """ETL 결과물 기본 품질 검증."""
    assert sales_df["quantity"].min() > 0, "❌ 음수 판매량 발견"
    assert set(sales_df["country"].unique()) == {"KOR", "JP", "US"}, "❌ 미등록 국가"
    assert set(sales_df["channel"].unique()) == {"amazon", "tiktok", "offline"}, "❌ 미등록 채널"
    assert sales_df["unit_price_usd"].min() > 0, "❌ 음수 단가 발견"

    inbound_total  = inventory_df[inventory_df["quantity"] > 0]["quantity"].sum()
    outbound_total = inventory_df[inventory_df["quantity"] < 0]["quantity"].sum()
    assert inbound_total + outbound_total > 0, "❌ 재고 원장 불균형: 순 재고가 음수"

    print(f"  [QA] ✅ 검증 통과 | 판매 {len(sales_df):,}건 "
          f"| 입고 {inbound_total:,}건 | 출고 {abs(outbound_total):,}건")


# =============================================================================
# MAIN ETL PIPELINE
# =============================================================================
def run_pipeline() -> None:
    print("=" * 60)
    print("  TIRTIR ERP 데이터 파이프라인")
    print(f"  기간: {BASE_DATE} → {END_DATE} ({(END_DATE-BASE_DATE).days}일)")
    print("=" * 60)

    # ── E: Extract ─────────────────────────────────────────────────────────────
    print("\n[1/3] Extract — 가상 ERP 파라미터 정의 완료")
    print(f"      제품 {len(PRODUCTS)}종 × 국가 3개 × 쉐이드 {len(extract_shade_codes())}개")

    # ── T: Transform ───────────────────────────────────────────────────────────
    print("\n[2/3] Transform — 데이터 생성 중...")
    sales_df     = transform_sales_orders()
    inventory_df = transform_inventory_ledger(sales_df)
    customers_df = transform_customer_segments()

    # 품질 검증
    print("\n  [QA] 데이터 품질 검증...")
    validate(sales_df, inventory_df)

    # ── L: Load ────────────────────────────────────────────────────────────────
    print("\n[3/3] Load — Supabase 적재...")
    load_to_supabase("sales_order",      sales_df)
    load_to_supabase("inventory_ledger", inventory_df)
    load_to_supabase("customer_segment", customers_df)

    # ── 요약 ──────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  ✅ 파이프라인 완료")
    print(f"     판매 주문:   {len(sales_df):>10,}건")
    print(f"     재고 원장:   {len(inventory_df):>10,}건")
    print(f"     고객 세그먼트: {len(customers_df):>8,}건")
    print("=" * 60)


if __name__ == "__main__":
    run_pipeline()
