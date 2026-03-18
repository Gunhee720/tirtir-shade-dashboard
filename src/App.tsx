/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search, ChevronDown, Calendar, TrendingUp, TrendingDown,
  LayoutGrid, LineChart as LineChartIcon, AlertTriangle,
  Megaphone, Rocket, Aperture, Check, X, Package, Users
} from 'lucide-react';
import cushionRedImg     from '../Cushion_image/마스크핏레드쿠션.png';
import cushionAiImg      from '../Cushion_image/마스크핏AI필터쿠션.png';
import cushionRubyImg    from '../Cushion_image/마스크핏루비메쉬쿠션.png';
import cushionCrystalImg from '../Cushion_image/마스크핏크리스탈메쉬쿠션.png';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  applyProductMod, snapIntensity,
  formatSalesK, formatLossKRW, dDayBadge,
} from './mockData';
import { useDashboardData } from './hooks/useDashboardData';

// ── Static shade list (colors never change) ────────────────────────────────────
const shades = [
  { name: '10C',   color: '#F6ECE2' }, { name: '13C',   color: '#F5EAE5' },
  { name: '13N',   color: '#F3E6D7' }, { name: '13W',   color: '#F3E7D7' },
  { name: '13.5N', color: '#F1E3D6' }, { name: '15C',   color: '#F2E2D9' },
  { name: '15.5N', color: '#F1E1CF' }, { name: '17C',   color: '#EFDED2' },
  { name: '17N',   color: '#EEDDC7' }, { name: '17W',   color: '#EDDDC4' },
  { name: '19C',   color: '#EAD2C1' }, { name: '19N',   color: '#EDD8BE' },
  { name: '19.5N', color: '#EAD4B9' }, { name: '21C',   color: '#EDD4C2' },
  { name: '21N',   color: '#E7CFB2' }, { name: '21W',   color: '#E6D2B4' },
  { name: '22C',   color: '#E9CFBE' }, { name: '22N',   color: '#E3C8A9' },
  { name: '22W',   color: '#E2CFAA' }, { name: '23N',   color: '#DFC4AF' },
  { name: '24N',   color: '#E5CAA7' }, { name: '24W',   color: '#DBBF98' },
  { name: '25N',   color: '#DCBD97' }, { name: '27C',   color: '#D5B9A3' },
  { name: '27N',   color: '#D1AE85' }, { name: '28N',   color: '#D4B797' },
  { name: '29C',   color: '#C5AA94' }, { name: '29N',   color: '#CDA887' },
  { name: '30N',   color: '#C49F73' }, { name: '31N',   color: '#C1A27C' },
  { name: '33C',   color: '#C2A58D' }, { name: '33N',   color: '#B89576' },
  { name: '33W',   color: '#B6966E' }, { name: '34C',   color: '#B99B82' },
  { name: '34N',   color: '#AF8B6C' }, { name: '34W',   color: '#AB8A62' },
  { name: '35N',   color: '#9F7A53' }, { name: '37C',   color: '#B58F72' },
  { name: '40N',   color: '#8E6C52' }, { name: '43N',   color: '#7B5941' },
  { name: '45N',   color: '#62432E' }, { name: '45W',   color: '#715134' },
  { name: '47N',   color: '#523726' }, { name: '51N',   color: '#452B1B' },
  { name: '55N',   color: '#342014' },
];
const shadeColorMap = Object.fromEntries(shades.map(s => [s.name, s.color]));

// ── Product list ───────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id: 'red',     name: '마스크핏 레드 쿠션',           sku: 'RD-CSN-01', img: cushionRedImg     },
  { id: 'ai',      name: '마스크핏 AI 필터 쿠션',         sku: 'AI-CSN-01', img: cushionAiImg      },
  { id: 'ruby',    name: '마스크핏 루비 메쉬 쿠션',       sku: 'RB-CSN-01', img: cushionRubyImg    },
  { id: 'crystal', name: '마스크핏 크리스탈 메쉬 쿠션',   sku: 'CR-CSN-01', img: cushionCrystalImg },
];

const ALL_COUNTRIES = ['KOR', 'JP', 'US'] as const;
const COUNTRY_FLAG: Record<string, string> = { KOR: 'https://flagcdn.com/kr.svg', JP: 'https://flagcdn.com/jp.svg', US: 'https://flagcdn.com/us.svg' };
// 국가별 채널 설정 (채널명 → 데이터 키 매핑 포함)
const COUNTRY_CHANNEL_CONFIG: Record<string, {
  channels: string[];
  labelMap: Record<string, 'amazon' | 'tiktok' | 'offline'>;  // 채널명 → 데이터키
  dataLabel: Record<string, string>;                            // 데이터키 → 표시명
}> = {
  KOR: {
    channels:  ['전체', '자사몰', '올리브영'],
    labelMap:  { '자사몰': 'amazon', '올리브영': 'offline' },
    dataLabel: { amazon: '자사몰', offline: '올리브영' },
  },
  JP: {
    channels:  ['전체', '아마존', '틱톡샵', '오프라인 리테일'],
    labelMap:  { '아마존': 'amazon', '틱톡샵': 'tiktok', '오프라인 리테일': 'offline' },
    dataLabel: { amazon: '아마존', tiktok: '틱톡샵', offline: '오프라인' },
  },
  US: {
    channels:  ['전체', '아마존', '틱톡샵', '오프라인 리테일'],
    labelMap:  { '아마존': 'amazon', '틱톡샵': 'tiktok', '오프라인 리테일': 'offline' },
    dataLabel: { amazon: '아마존', tiktok: '틱톡샵', offline: '오프라인' },
  },
};

// ── App ─────────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [selectedProductId,  setSelectedProductId]  = useState<string>('red');
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [selectedCountry,    setSelectedCountry]    = useState<string>('KOR');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [selectedChannel,    setSelectedChannel]    = useState<string>('전체');
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);

  // ── Heatmap / chart state ────────────────────────────────────────────────────
  const [selectedShade, setSelectedShade] = useState<string>('21N');
  const [shadePopup,    setShadePopup]    = useState<{ name: string; color: string } | null>(null);

  // ── Action card state ────────────────────────────────────────────────────────
  const [abTestEnabled, setAbTestEnabled] = useState(true);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['이메일', '앱 푸시']);
  const [actionSent, setActionSent] = useState(false);

  function toggleChannel(ch: string) {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  }
  function handleSend() {
    setActionSent(true);
    setTimeout(() => { setActionSent(false); setActionModalOpen(false); }, 1800);
  }

  // ── Dropdown refs ────────────────────────────────────────────────────────────
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const channelDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node))
        setCountryDropdownOpen(false);
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(e.target as Node))
        setChannelDropdownOpen(false);
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node))
        setProductDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 국가 변경 시 채널 초기화
  useEffect(() => { setSelectedChannel('전체'); }, [selectedCountry]);

  const channelConfig   = COUNTRY_CHANNEL_CONFIG[selectedCountry] ?? COUNTRY_CHANNEL_CONFIG['JP'];
  const availableChannels = channelConfig.channels;

  const currentProduct = PRODUCTS.find(p => p.id === selectedProductId) ?? PRODUCTS[0];

  // ── 1. Aggregate raw country data (Supabase DB → mock fallback) ─────────────
  // channelDbKey: 전체='전체'이면 null(집계), 특정 채널이면 DB 키('amazon'|'offline')
  const channelDbKey = selectedChannel === '전체'
    ? null
    : (channelConfig.labelMap[selectedChannel] ?? null);
  const { data: dashboardData, isLive } = useDashboardData(selectedProductId, [selectedCountry], channelDbKey);

  // ── 2. Apply product modifier to shade intensities ───────────────────────────
  const computedIntensities = useMemo(() => {
    if (!dashboardData) return {} as Record<string, number>;
    const result: Record<string, number> = {};
    Object.entries(dashboardData.shadeIntensity).forEach(([name, intensity]) => {
      result[name] = snapIntensity(applyProductMod(selectedProductId, name, intensity));
    });
    return result;
  }, [dashboardData, selectedProductId]);

  // ── 3. Top 3 shades from computed intensities ────────────────────────────────
  const top3Shades = useMemo(() => {
    const sorted = Object.entries(computedIntensities)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3);
    const total = sorted.reduce((s, [, i]) => s + (i as number), 0) || 1;
    return sorted.map(([name, intensity]) => ({
      shade: name,
      color: shadeColorMap[name] ?? '#E7CFB2',
      pct:   `${Math.round(((intensity as number) / total) * 100)}%`,
    }));
  }, [computedIntensities]);

  // ── 4. Velocity data scaled to selected shade ────────────────────────────────
  const shadeVelocityData = useMemo(() => {
    if (!dashboardData) return [];
    const sel = computedIntensities[selectedShade] ?? 20;
    const max = Math.max(...(Object.values(computedIntensities) as number[]), 1);
    const scale = sel / max;
    return dashboardData.velocity.map(pt => ({
      ...pt,
      amazon:  Math.round(pt.amazon  * scale),
      tiktok:  Math.round(pt.tiktok  * scale),
      offline: Math.round(pt.offline * scale),
    }));
  }, [dashboardData, selectedShade, computedIntensities]);

  // ── 5. Channel-specific burn rate multiplier ─────────────────────────────────
  const channelBurnMult = useMemo(() => {
    if (!dashboardData || selectedChannel === '전체') return 1;
    const last  = dashboardData.velocity[dashboardData.velocity.length - 1];
    const total = last.amazon + last.tiktok + last.offline;
    if (total === 0) return 1;
    const key = channelConfig.labelMap[selectedChannel];
    if (key === 'amazon')  return last.amazon  / total;
    if (key === 'tiktok')  return last.tiktok  / total;
    if (key === 'offline') return last.offline / total;
    return 1;
  }, [dashboardData, selectedChannel, channelConfig]);

  // ── 6. Projected burn rate for the velocity chart footer ─────────────────────
  const projectedBurnRate = useMemo(() => {
    if (!dashboardData) return 0;
    const last  = shadeVelocityData[shadeVelocityData.length - 1];
    if (!last) return 0;
    const key = channelConfig.labelMap[selectedChannel];
    const sa = selectedChannel === '전체' || key === 'amazon';
    const st = selectedChannel === '전체' || key === 'tiktok';
    const so = selectedChannel === '전체' || key === 'offline';
    return (sa ? last.amazon : 0) + (st ? last.tiktok : 0) + (so ? last.offline : 0);
  }, [dashboardData, shadeVelocityData, selectedChannel, channelConfig]);

  // ── 7. Heatmap popup channel-split values ───────────────────────────────────
  const popupChannelValues = useMemo(() => {
    if (!shadePopup || !dashboardData) return { amazon: 0, tiktok: 0, offline: 0 };
    const sel   = computedIntensities[shadePopup.name] ?? 5;
    const max   = Math.max(...(Object.values(computedIntensities) as number[]), 1);
    const scale = sel / max;
    const last  = dashboardData.velocity[dashboardData.velocity.length - 1];
    return {
      amazon:  Math.round(last.amazon  * scale),
      tiktok:  Math.round(last.tiktok  * scale),
      offline: Math.round(last.offline * scale),
    };
  }, [shadePopup, dashboardData, computedIntensities]);

  // ── Channel line visibility ──────────────────────────────────────────────────
  const _selKey    = channelConfig.labelMap[selectedChannel];
  const showAmazon  = selectedChannel === '전체' || _selKey === 'amazon';
  const showTiktok  = selectedChannel === '전체' || _selKey === 'tiktok';
  const showOffline = selectedChannel === '전체' || _selKey === 'offline';
  // KOR은 틱톡 채널 없음
  const hasTiktok   = Boolean(channelConfig.dataLabel['tiktok']);

  // ── Null guard ───────────────────────────────────────────────────────────────
  const noData = !dashboardData;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f5f6] text-slate-900 pb-10" style={{ fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      {/* ── Header ── */}
      <header className="bg-white border-b border-[#e0001a]/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-[#e0001a]">
            <Aperture size={28} strokeWidth={2.5} />
            <h2 className="text-slate-900 text-lg font-bold tracking-tight uppercase">TIRTIR Shade-Sync</h2>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-[#e0001a] text-sm font-semibold border-b-2 border-[#e0001a] pb-1">대시보드</a>
            <a href="#" className="text-slate-500 text-sm font-medium hover:text-[#e0001a] transition-colors pb-1">재고</a>
            <a href="#" className="text-slate-500 text-sm font-medium hover:text-[#e0001a] transition-colors pb-1">판매</a>
            <a href="#" className="text-slate-500 text-sm font-medium hover:text-[#e0001a] transition-colors pb-1">마케팅</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {/* DB 연결 상태 배지 */}
          <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            isLive
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {isLive ? 'LIVE DB' : 'MOCK DATA'}
          </span>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="제품 또는 호수 검색"
              className="bg-slate-100 border-none rounded-lg pl-9 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-[#e0001a]/20 outline-none" />
          </div>
          <img src="https://i.pravatar.cc/150?img=32" alt="User"
            className="w-9 h-9 rounded-full border-2 border-[#e0001a]/20" />
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-xl border border-[#e0001a]/5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Filters</span>

          {/* Country */}
          <div className="relative" ref={countryDropdownRef}>
            <button
              onClick={() => { setCountryDropdownOpen((p: boolean) => !p); setChannelDropdownOpen(false); }}
              className="flex items-center gap-2 rounded-lg bg-[#e0001a]/5 border border-[#e0001a]/10 px-4 py-1.5 text-sm font-semibold hover:bg-[#e0001a]/10 transition-colors"
            >
              <img src={COUNTRY_FLAG[selectedCountry]} alt={selectedCountry} className="w-5 h-3.5 object-cover rounded-sm" />
              <span>국가: {selectedCountry}</span>
              <ChevronDown size={16} className={`transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {countryDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 bg-white rounded-xl border border-[#e0001a]/10 shadow-lg z-20 py-1 min-w-[140px]">
                {ALL_COUNTRIES.map(country => (
                  <button key={country} onClick={() => { setSelectedCountry(country); setCountryDropdownOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm font-semibold hover:bg-[#e0001a]/5 transition-colors">
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      selectedCountry === country ? 'bg-[#e0001a] border-[#e0001a]' : 'border-slate-300'
                    }`}>
                      {selectedCountry === country && <Check size={8} className="text-white" />}
                    </span>
                    <img src={COUNTRY_FLAG[country]} alt={country} className="w-5 h-3.5 object-cover rounded-sm" />
                    {country}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Channel */}
          <div className="relative" ref={channelDropdownRef}>
            <button
              onClick={() => { setChannelDropdownOpen((p: boolean) => !p); setCountryDropdownOpen(false); }}
              className="flex items-center gap-2 rounded-lg bg-[#e0001a]/5 border border-[#e0001a]/10 px-4 py-1.5 text-sm font-semibold hover:bg-[#e0001a]/10 transition-colors"
            >
              <span>채널: {selectedChannel}</span>
              <ChevronDown size={16} className={`transition-transform ${channelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {channelDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 bg-white rounded-xl border border-[#e0001a]/10 shadow-lg z-20 py-1 min-w-[160px]">
                {availableChannels.map(ch => (
                  <button key={ch} onClick={() => { setSelectedChannel(ch); setChannelDropdownOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm font-semibold hover:bg-[#e0001a]/5 transition-colors">
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      selectedChannel === ch ? 'bg-[#e0001a] border-[#e0001a]' : 'border-slate-300'
                    }`}>
                      {selectedChannel === ch && <Check size={8} className="text-white" />}
                    </span>
                    {ch}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="flex items-center gap-2 rounded-lg bg-[#e0001a]/5 border border-[#e0001a]/10 px-4 py-1.5 text-sm font-semibold hover:bg-[#e0001a]/10 transition-colors ml-auto">
            <Calendar size={16} />
            <span>최근 30일</span>
          </button>
        </div>

        {/* ── No-data guard ── */}
        {noData ? (
          <div className="bg-white rounded-xl p-16 flex flex-col items-center justify-center text-slate-400 shadow-sm border border-[#e0001a]/5 gap-3">
            <AlertTriangle size={32} className="text-slate-300" />
            <p className="font-semibold">국가를 하나 이상 선택하세요</p>
          </div>
        ) : (
          <>
            {/* ── Product Overview ── */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 flex gap-6 border-r border-slate-100 pr-6">
                <div className="bg-white rounded-lg h-32 w-32 shrink-0 flex items-center justify-center p-2 relative overflow-hidden group border border-slate-100">
                  <div className="absolute inset-0 bg-[#e0001a]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img src={currentProduct.img} alt={currentProduct.name}
                    className="w-full h-full object-contain transform group-hover:scale-105 transition-transform" />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-[#e0001a] text-white text-[10px] font-bold px-2 py-0.5 rounded">베스트셀러</span>
                    <span className="text-slate-400 text-xs font-medium uppercase tracking-tighter">SKU: {currentProduct.sku}</span>
                  </div>
                  {/* Product selector */}
                  <div className="relative" ref={productDropdownRef}>
                    <button onClick={() => setProductDropdownOpen((p: boolean) => !p)}
                      className="flex items-center gap-1 -ml-1 pl-1 rounded-md hover:bg-slate-50 transition-colors">
                      <h1 className="text-2xl font-black text-slate-900 tracking-tight">{currentProduct.name}</h1>
                      <ChevronDown size={20} className={`text-slate-400 hover:text-[#e0001a] transition-all ${productDropdownOpen ? 'rotate-180 text-[#e0001a]' : ''}`} />
                    </button>
                    {productDropdownOpen && (
                      <div className="absolute top-full mt-2 left-0 bg-white rounded-xl border border-[#e0001a]/10 shadow-xl z-30 py-1 w-72">
                        {PRODUCTS.map(product => (
                          <button key={product.id}
                            onClick={() => { setSelectedProductId(product.id); setProductDropdownOpen(false); }}
                            className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm hover:bg-[#e0001a]/5 transition-colors ${selectedProductId === product.id ? 'bg-[#e0001a]/5' : ''}`}>
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                              <img src={product.img} alt={product.name} className="w-full h-full object-contain" />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-slate-900 leading-tight">{product.name}</p>
                              <p className="text-[10px] text-slate-400">{product.sku}</p>
                            </div>
                            {selectedProductId === product.id && (
                              <Check size={14} className="text-[#e0001a] ml-auto flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mt-1">글로벌 유통 프로필 · {selectedCountry}</p>
                </div>
              </div>

              {/* Sales KPIs */}
              <div className="lg:col-span-4 flex justify-center border-r border-slate-100 pr-6 items-center gap-12 xl:gap-20">
                <div className="space-y-2">
                  <p className="text-slate-500 text-sm font-black uppercase tracking-widest">누적 매출</p>
                  <p className="text-4xl font-black text-slate-900">{formatSalesK(dashboardData.totalSalesK)}</p>
                  <p className={`text-sm font-bold flex items-center gap-1 ${dashboardData.momGrowth >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                    {dashboardData.momGrowth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {dashboardData.momGrowth >= 0 ? `+${dashboardData.momGrowth}%` : `${dashboardData.momGrowth}%`}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-500 text-sm font-black uppercase tracking-widest">전월 대비 성장</p>
                  <p className={`text-4xl font-black ${dashboardData.momGrowth >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                    {dashboardData.momGrowth >= 0 ? `+${dashboardData.momGrowth}%` : `${dashboardData.momGrowth}%`}
                  </p>
                  <p className={`text-xs font-semibold flex items-center gap-1 ${
                    dashboardData.momGrowth >= dashboardData.momTarget ? 'text-emerald-600' : 'text-orange-500'
                  }`}>
                    {dashboardData.momGrowth >= dashboardData.momTarget
                      ? <><TrendingUp size={12} /> 목표 초과 (목표: {dashboardData.momTarget}%)</>
                      : <><TrendingDown size={12} /> 목표 미달 (목표: {dashboardData.momTarget}%)</>}
                  </p>
                </div>
              </div>

              {/* Top 3 Shades */}
              <div className="lg:col-span-4 flex flex-col justify-center">
                <p className="text-slate-500 text-sm font-black uppercase tracking-widest mb-3">
                  Top 3 호수 ({selectedCountry} 기준)
                </p>
                <div className="flex gap-3">
                  {top3Shades.map(item => {
                    const isSelected = selectedShade === item.shade;
                    return (
                      <button key={item.shade} onClick={() => setSelectedShade(item.shade)}
                        className={`flex-1 p-3 rounded-xl text-center border shadow-sm hover:shadow-md transition-all duration-200 ${
                          isSelected
                            ? 'bg-[#e0001a] border-[#e0001a] shadow-[#e0001a]/30 shadow-lg scale-105'
                            : 'bg-white border-slate-100 hover:border-[#e0001a]/30'
                        }`}
                        style={isSelected ? {} : { borderBottomColor: item.color, borderBottomWidth: 4 }}>
                        <div className="flex items-center justify-center gap-2 mb-0.5">
                          <div className={`w-3 h-3 rounded-full ${isSelected ? 'border border-white/30' : 'border border-black/5'}`}
                            style={{ backgroundColor: item.color }}></div>
                          <span className={`text-lg font-black ${isSelected ? 'text-white' : 'text-slate-900'}`}>{item.shade}</span>
                        </div>
                        <span className={`text-xs font-bold ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>{item.pct}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Middle: Heatmap + Velocity ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Heatmap */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <LayoutGrid className="text-[#e0001a]" size={20} />
                    45 쉐이드 히트맵 (판매 강도)
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                    <span>낮음</span>
                    <div className="flex gap-0.5">
                      {[5,20,40,70,100].map(v => (
                        <div key={v} className={`w-3 h-3 rounded-sm ${
                          v===5?'bg-[#e0001a]/5':v===20?'bg-[#e0001a]/20':v===40?'bg-[#e0001a]/40':v===70?'bg-[#e0001a]/70':'bg-[#e0001a]'
                        }`}></div>
                      ))}
                    </div>
                    <span>높음</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  호수를 클릭하면 채널별 소진 속도를 확인할 수 있습니다
                  <span className="ml-1 text-[#e0001a]">({selectedCountry})</span>
                </p>

                <div className="grid grid-cols-9 gap-1.5">
                  {shades.map(shade => {
                    const intensity  = computedIntensities[shade.name] ?? 5;
                    const isSelected = selectedShade === shade.name;
                    const isTop3     = top3Shades.some(t => t.shade === shade.name);
                    return (
                      <button
                        key={shade.name}
                        onClick={() => { setSelectedShade(shade.name); setShadePopup(shade); }}
                        title={`${shade.name} - 클릭하여 상세 보기`}
                        className={`aspect-square rounded flex flex-col items-center justify-center font-bold cursor-pointer hover:scale-110 transition-transform ${
                          intensity >= 40 ? 'text-white' : 'text-[#e0001a]/80'
                        } ${
                          intensity===5  ? 'bg-[#e0001a]/5'  :
                          intensity===20 ? 'bg-[#e0001a]/20' :
                          intensity===40 ? 'bg-[#e0001a]/40' :
                          intensity===70 ? 'bg-[#e0001a]/70' : 'bg-[#e0001a]'
                        } ${
                          isSelected ? 'ring-2 ring-offset-1 ring-slate-900 scale-110' :
                          isTop3     ? 'shadow-lg shadow-[#e0001a]/20 ring-2 ring-[#e0001a] ring-offset-2' : ''
                        }`}
                      >
                        <div
                          className={`w-[8.8px] h-[8.8px] rounded-full mb-0.5 ${intensity >= 40 ? 'border border-white/20' : 'border border-black/5'}`}
                          style={{ backgroundColor: shade.color }}
                        ></div>
                        <span className="text-[8.8px] font-bold leading-none">{shade.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Shade Popup */}
                {shadePopup && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 relative">
                    <button onClick={() => setShadePopup(null)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: shadePopup.color }}></div>
                      <div>
                        <p className="font-black text-base text-slate-900">호수 {shadePopup.name}</p>
                        <p className="text-xs text-slate-500">
                          판매 강도: {(() => {
                            const v = computedIntensities[shadePopup.name] ?? 5;
                            return v===5?'낮음':v===20?'보통':v===40?'양호':v===70?'높음':'최고';
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className={`grid gap-2 text-center text-xs ${hasTiktok ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <div className="bg-white rounded-lg p-2 border border-slate-100">
                        <p className="text-slate-400 font-bold mb-1">{channelConfig.dataLabel.amazon}</p>
                        <p className="font-black text-[#e0001a]">{popupChannelValues.amazon}/일</p>
                      </div>
                      {hasTiktok && (
                        <div className="bg-white rounded-lg p-2 border border-slate-100">
                          <p className="text-slate-400 font-bold mb-1">{channelConfig.dataLabel.tiktok}</p>
                          <p className="font-black text-slate-800">{popupChannelValues.tiktok}/일</p>
                        </div>
                      )}
                      <div className="bg-white rounded-lg p-2 border border-slate-100">
                        <p className="text-slate-400 font-bold mb-1">{channelConfig.dataLabel.offline}</p>
                        <p className="font-black text-slate-500">{popupChannelValues.offline}/일</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sales Velocity */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5 flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <LineChartIcon className="text-[#e0001a]" size={20} />
                    채널별 소진 속도: 호수 {selectedShade}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  히트맵 또는 Top 3 카드 클릭 시 해당 호수 데이터로 변경됩니다
                </p>
                <div className="flex gap-4 mb-4">
                  {showAmazon  && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#e0001a]"></div><span className="text-[10px] font-bold text-slate-500">{channelConfig.dataLabel.amazon}</span></div>}
                  {hasTiktok && showTiktok  && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-800"></div><span className="text-[10px] font-bold text-slate-500">{channelConfig.dataLabel.tiktok}</span></div>}
                  {showOffline && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400"></div><span className="text-[10px] font-bold text-slate-500">{channelConfig.dataLabel.offline}</span></div>}
                </div>
                <div className="flex-1 relative min-h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={shadeVelocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [value, channelConfig.dataLabel[name] ?? name]}
                      />
                      {showAmazon  && <Line type="monotone" dataKey="amazon"  stroke="#e0001a" strokeWidth={3} dot={false} />}
                      {hasTiktok && showTiktok  && <Line type="monotone" dataKey="tiktok"  stroke="#1e293b" strokeWidth={2} strokeDasharray="4 4" dot={false} />}
                      {showOffline && <Line type="monotone" dataKey="offline" stroke="#94a3b8" strokeWidth={2} dot={false} />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                  <span className="text-xs font-semibold">
                    일일 소진 속도 (예측) · {selectedShade} · {selectedChannel === '전체' ? '전 채널' : selectedChannel}
                  </span>
                  <span className="text-xs font-black text-[#e0001a]">
                    {projectedBurnRate.toLocaleString()} 개 / 일
                  </span>
                </div>
              </div>
            </div>

            {/* ── Bottom ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Inventory + Dead Stock */}
              <div className="lg:col-span-5 space-y-4">
                {/* OOS Alert */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-[#e0001a]" size={20} />
                    재고 알림: 품절 예상 D-Day
                  </h3>
                  <div className="overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="pb-3 px-1">호수</th>
                          <th className="pb-3 px-1">재고</th>
                          <th className="pb-3 px-1">소진 속도</th>
                          <th className="pb-3 px-1 text-right">D-Day</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {dashboardData.inventory.map(item => {
                          const effBurnRate = Math.max(1, Math.round(item.burnRate * channelBurnMult));
                          const dDay = Math.round(item.stock / effBurnRate);
                          const badge = dDayBadge(dDay);
                          return (
                            <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-1 font-bold">{item.shade}</td>
                              <td className="py-3 px-1">{item.stock.toLocaleString()}</td>
                              <td className="py-3 px-1">{effBurnRate.toLocaleString()}/일</td>
                              <td className="py-3 px-1 text-right">
                                <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3">
                    🚨 D-14 이내: 긴급 항공 발주 필요 · ⚠️ D-30 이내: 해상 발주 준비
                    {selectedChannel !== '전체' && (
                      <span className="ml-1 text-[#e0001a] font-semibold">({selectedChannel} 채널 기준)</span>
                    )}
                  </p>
                </div>

                {/* Dead Stock */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-orange-100">
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2 text-orange-600">
                    <Package size={18} />
                    악성 재고 (Dead Stock) 경고
                  </h3>
                  <div className="space-y-3">
                    {dashboardData.deadStock.map(item => (
                      <div key={item.shade} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.shade}</p>
                          <p className="text-xs text-slate-400">재고 정체 {item.months}개월</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-orange-600">{formatLossKRW(item.lossKRW)}</p>
                          <p className="text-[10px] text-slate-400">보관 손실 추정</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Customer Profiling + Action Card */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* Customer Profiling */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Users size={20} className="text-[#e0001a]" />
                      구매자 세그먼트 분석
                    </h3>
                    <div className="flex gap-2">
                      <span className="bg-slate-100 text-[10px] font-bold px-2 py-1 rounded">
                        {selectedCountry} 데이터
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex gap-4 items-center border-r border-slate-100 pr-6">
                      <div className="relative size-20 shrink-0">
                        <svg className="size-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100" strokeWidth="4" />
                          <circle cx="18" cy="18" r="16" fill="none" className="stroke-[#e0001a]" strokeWidth="4"
                            strokeDasharray={`${dashboardData.femalePct}, 100`} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-sm font-black">{dashboardData.femalePct}%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-400 uppercase">연령 / 성별</p>
                        <p className="text-sm font-bold">{dashboardData.ageGroup}</p>
                        <div className="flex gap-1">
                          <div className="h-1.5 rounded-full bg-[#e0001a]"
                            style={{ width: `${dashboardData.femalePct * 0.64}px` }}></div>
                          <div className="h-1.5 w-4 bg-slate-200 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center space-y-3">
                      <p className="text-xs font-bold text-slate-400 uppercase">RFM 세그먼트</p>
                      <div className="space-y-2">
                        {[
                          { label: 'VIP (고가치 고객)',   count: dashboardData.vipCount,      color: 'bg-[#e0001a]' },
                          { label: '이탈 위험 (잠재 이탈)', count: dashboardData.atRiskCount,    color: 'bg-slate-400' },
                          { label: '신규 바이럴 유입',    count: dashboardData.newViralCount,  color: 'bg-emerald-400' },
                        ].map(seg => {
                          const total = dashboardData.vipCount + dashboardData.atRiskCount + dashboardData.newViralCount;
                          const pct = Math.round((seg.count / total) * 100);
                          return (
                            <div key={seg.label}>
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-medium text-slate-600">{seg.label}</span>
                                <span className="font-bold">{seg.count.toLocaleString()}명</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${seg.color}`} style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Card */}
                <div className="bg-slate-900 rounded-xl p-6 shadow-xl border border-white/10 relative overflow-hidden text-white flex flex-col flex-1">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#e0001a]/20 blur-3xl -mr-16 -mt-16 rounded-full"></div>
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-[#e0001a] flex items-center justify-center">
                          <Megaphone size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#e0001a] tracking-widest uppercase">스마트 추천</p>
                          <h4 className="font-bold text-lg">재고 최적화 캠페인</h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase opacity-60">A/B 테스트</span>
                        <button onClick={() => setAbTestEnabled((p: boolean) => !p)}
                          className={`w-8 h-4 rounded-full relative flex items-center px-0.5 cursor-pointer transition-colors ${abTestEnabled ? 'bg-[#e0001a]' : 'bg-white/20'}`}>
                          <div className={`size-3 bg-white rounded-full transition-transform ${abTestEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </button>
                      </div>
                    </div>

                    <p className="text-slate-400 text-base mb-3 leading-relaxed">
                      {dashboardData.deadStock.length > 0 ? (
                        <>
                          <span className="text-white font-bold">{dashboardData.deadStock[0].shade}</span> 재고가{' '}
                          <span className="text-white font-bold">{dashboardData.deadStock[0].months}개월</span>째{' '}
                          <span className="text-white font-bold">{{ KOR: '한국', JP: '일본', US: '미국' }[selectedCountry] ?? selectedCountry} 시장</span>에서 느리게 소진되고 있습니다.
                          RFM 우수 고객 대상으로 개인화 번들 할인 오퍼 발송을 권장합니다.
                        </>
                      ) : (
                        <>
                          <span className="text-white font-bold">{dashboardData.actionShade}</span> 호수의 재고가{' '}
                          <span className="text-white font-bold">{dashboardData.actionMarket}</span> 시장에서 예상보다 느리게 소진되고 있습니다.
                          RFM 우수 고객 대상으로 개인화 번들 할인 오퍼 발송을 권장합니다.
                        </>
                      )}
                    </p>

                    {abTestEnabled && (
                      <p className="text-[#e0001a]/80 text-base mb-3 font-semibold leading-relaxed">
                        ▸ A/B 테스트 활성화: 대조군({Math.round(dashboardData.actionTarget / 2).toLocaleString()}명) / 실험군({Math.round(dashboardData.actionTarget / 2).toLocaleString()}명)으로 분리하여 프로모션 성과를 측정합니다.
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-4">
                      <div className="flex gap-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-500">타겟</span>
                          <span className="font-bold">VIP {dashboardData.actionTarget.toLocaleString()}명</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-500">기대 ROI</span>
                          <span className="font-bold text-emerald-400">{dashboardData.actionRoi}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-500">발송 채널</span>
                          <span className="font-bold">이메일 + 앱 푸시</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setActionSent(false); setActionModalOpen(true); }}
                        className="bg-[#e0001a] hover:bg-red-700 transition-colors text-white font-black px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm tracking-wider">
                        액션 실행
                        <Rocket size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* 액션 실행 확인 모달 */}
      {actionModalOpen && dashboardData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !actionSent && setActionModalOpen(false)}
          />

          {/* Modal card */}
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md text-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-white/10">
              <div className="size-9 rounded-lg bg-[#e0001a] flex items-center justify-center shrink-0">
                <Megaphone size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#e0001a] tracking-widest uppercase">캠페인 발송 확인</p>
                <h3 className="font-bold text-base leading-tight">재고 최적화 오퍼 발송</h3>
              </div>
            </div>

            {actionSent ? (
              /* 발송 완료 상태 */
              <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
                <div className="size-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check size={28} className="text-emerald-400" />
                </div>
                <p className="font-bold text-lg text-emerald-400">발송이 시작되었습니다!</p>
                <p className="text-slate-400 text-sm">
                  {selectedChannels.join(' + ')} 채널로 VIP {dashboardData.actionTarget.toLocaleString()}명에게 발송 중입니다.
                </p>
              </div>
            ) : (
              <>
                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    RFM 우수 고객 대상으로 개인화 번들 할인 오퍼 발송을 진행할까요?
                  </p>
                  <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-slate-400 text-sm">예상 발송 인원</span>
                    <span className="font-black text-xl text-white">VIP {dashboardData.actionTarget.toLocaleString()}명</span>
                  </div>

                  {/* 채널 선택 */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">발송 채널 선택 (다중 선택 가능)</p>
                    <div className="flex gap-3">
                      {['이메일', '앱 푸시'].map(ch => {
                        const active = selectedChannels.includes(ch);
                        return (
                          <button
                            key={ch}
                            onClick={() => toggleChannel(ch)}
                            className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                              active
                                ? 'border-[#e0001a] bg-[#e0001a]/15 text-white'
                                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                            }`}
                          >
                            {ch === '이메일' ? '✉️  이메일' : '📱  앱 푸시'}
                          </button>
                        );
                      })}
                    </div>
                    {selectedChannels.length === 0 && (
                      <p className="text-[#e0001a] text-xs mt-2">채널을 한 개 이상 선택해주세요.</p>
                    )}
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="px-6 pb-6 flex gap-3">
                  <button
                    onClick={() => setActionModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-bold text-sm transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={selectedChannels.length === 0}
                    className="flex-1 py-2.5 rounded-xl bg-[#e0001a] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed font-black text-sm tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    발송 시작
                    <Rocket size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
