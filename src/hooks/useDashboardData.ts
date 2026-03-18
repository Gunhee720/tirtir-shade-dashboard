/**
 * useDashboardData — 대시보드 데이터 레이어 훅
 * ================================================
 * 우선순위:
 *   1순위: Supabase DB (VITE_SUPABASE_URL 설정 시)
 *   2순위: mockData.ts 집계 (로컬 개발 / DB 미연결)
 *
 * channel 파라미터:
 *   null    → 전체 집계 (RPC 결과 그대로)
 *   'amazon'|'tiktok'|'offline' → 채널별 shade intensity + 고객 세그먼트 오버라이드
 */

import { useState, useEffect, useMemo } from 'react';
import {
  fetchDashboardMetrics,
  fetchChannelOverrides,
  isSupabaseConfigured,
  type ChannelOverrides,
} from '../lib/supabase';
import { MOCK_DATA, aggregateMetrics } from '../mockData';
import type { CountryMetrics } from '../mockData';

export interface DashboardDataResult {
  data:    CountryMetrics | null;
  loading: boolean;
  isLive:  boolean;   // true = Supabase DB, false = mock
}

export function useDashboardData(
  productId: string,
  countries: string[],
  channel:   string | null,   // null = 전체
): DashboardDataResult {
  const [liveData,        setLiveData]        = useState<CountryMetrics | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [isLive,          setIsLive]          = useState(false);
  const [channelOverrides, setChannelOverrides] = useState<ChannelOverrides | null>(null);

  // countries 배열의 참조 안정성 확보 (join으로 메모화 키 생성)
  const countriesKey = countries.slice().sort().join(',');

  // ── Effect 1: RPC 기반 집계 데이터 (전체 기간, 전체 채널) ──────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || countries.length === 0) {
      setLiveData(null);
      setIsLive(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetchDashboardMetrics(productId, countries, controller.signal)
      .then(result => {
        if (result) {
          setLiveData(result);
          setIsLive(true);
        } else {
          setLiveData(null);
          setIsLive(false);
        }
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') {
          setLiveData(null);
          setIsLive(false);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, countriesKey]);

  // ── Effect 2: 채널 선택 시 오버라이드 (shade intensity + 고객 세그먼트) ────
  useEffect(() => {
    if (!isSupabaseConfigured || !channel || countries.length === 0) {
      setChannelOverrides(null);
      return;
    }

    const controller = new AbortController();

    fetchChannelOverrides(productId, countries[0], channel, controller.signal)
      .then(overrides => {
        if (!controller.signal.aborted) setChannelOverrides(overrides);
      })
      .catch(err => {
        if ((err as Error).name !== 'AbortError') setChannelOverrides(null);
      });

    return () => controller.abort();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, countriesKey, channel]);

  // ── Mock fallback: mockData.ts 집계 (Supabase 미연결 시) ──────────────────
  // useMemo는 조건부 return 이전에 항상 호출해야 함 (Rules of Hooks)
  const mockData = useMemo(() => {
    if (countries.length === 0) return null;
    const productData = MOCK_DATA[productId];
    if (!productData) return null;
    const list = countries.filter(c => productData[c]).map(c => productData[c]);
    if (list.length === 0) return null;
    return aggregateMetrics(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, countriesKey]);

  // ── 베이스 데이터 결정 ──────────────────────────────────────────────────────
  const baseData: CountryMetrics | null = (isLive && liveData) ? liveData : mockData;

  // ── 채널 오버라이드 머지 ────────────────────────────────────────────────────
  // channel이 null이거나 오버라이드 데이터가 없으면 베이스 데이터 그대로 사용
  const mergedData = useMemo(() => {
    if (!baseData || !channel || !channelOverrides) return baseData;
    return {
      ...baseData,
      shadeIntensity: channelOverrides.shadeIntensity,
      femalePct:      channelOverrides.femalePct,
      ageGroup:       channelOverrides.ageGroup,
      vipCount:       channelOverrides.vipCount,
      atRiskCount:    channelOverrides.atRiskCount,
      newViralCount:  channelOverrides.newViralCount,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseData, channel, channelOverrides]);

  return { data: mergedData, loading, isLive };
}
