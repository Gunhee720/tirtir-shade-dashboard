/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Search,
  ChevronDown,
  Calendar,
  TrendingUp,
  LayoutGrid,
  LineChart as LineChartIcon,
  AlertTriangle,
  Megaphone,
  Rocket,
  Aperture
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const shades = [
  { name: '10C', color: '#F6ECE2', intensity: 20 },
  { name: '13C', color: '#F5EAE5', intensity: 5 },
  { name: '13N', color: '#F3E6D7', intensity: 40 },
  { name: '13W', color: '#F3E7D7', intensity: 5 },
  { name: '13.5N', color: '#F1E3D6', intensity: 20 },
  { name: '15C', color: '#F2E2D9', intensity: 70 },
  { name: '15.5N', color: '#F1E1CF', intensity: 20 },
  { name: '17C', color: '#EFDED2', intensity: 100, highlight: true },
  { name: '17N', color: '#EEDDC7', intensity: 40 },
  { name: '17W', color: '#EDDDC4', intensity: 5 },
  { name: '19C', color: '#EAD2C1', intensity: 40 },
  { name: '19N', color: '#EDD8BE', intensity: 5 },
  { name: '19.5N', color: '#EAD4B9', intensity: 20 },
  { name: '21C', color: '#EDD4C2', intensity: 5 },
  { name: '21N', color: '#E7CFB2', intensity: 100, highlight: true },
  { name: '21W', color: '#E6D2B4', intensity: 70 },
  { name: '22C', color: '#E9CFBE', intensity: 5 },
  { name: '22N', color: '#E3C8A9', intensity: 20 },
  { name: '22W', color: '#E2CFAA', intensity: 5 },
  { name: '23N', color: '#DFC4AF', intensity: 100, highlight: true },
  { name: '24N', color: '#E5CAA7', intensity: 40 },
  { name: '24W', color: '#DBBF98', intensity: 20 },
  { name: '25N', color: '#DCBD97', intensity: 70 },
  { name: '27C', color: '#D5B9A3', intensity: 5 },
  { name: '27N', color: '#D1AE85', intensity: 20 },
  { name: '28N', color: '#D4B797', intensity: 40 },
  { name: '29C', color: '#C5AA94', intensity: 5 },
  { name: '29N', color: '#CDA887', intensity: 70 },
  { name: '30N', color: '#C49F73', intensity: 20 },
  { name: '31N', color: '#C1A27C', intensity: 20 },
  { name: '33C', color: '#C2A58D', intensity: 5 },
  { name: '33N', color: '#B89576', intensity: 40 },
  { name: '33W', color: '#B6966E', intensity: 5 },
  { name: '34C', color: '#B99B82', intensity: 5 },
  { name: '34N', color: '#AF8B6C', intensity: 5 },
  { name: '34W', color: '#AB8A62', intensity: 5 },
  { name: '35N', color: '#9F7A53', intensity: 40 },
  { name: '37C', color: '#B58F72', intensity: 5 },
  { name: '40N', color: '#8E6C52', intensity: 20 },
  { name: '43N', color: '#7B5941', intensity: 40 },
  { name: '45N', color: '#62432E', intensity: 5 },
  { name: '45W', color: '#715134', intensity: 5 },
  { name: '47N', color: '#523726', intensity: 5 },
  { name: '51N', color: '#452B1B', intensity: 5 },
  { name: '55N', color: '#342014', intensity: 5 },
];

const salesData = [
  { day: 'DAY 01', amazon: 20, tiktok: 10, offline: 30 },
  { day: 'DAY 07', amazon: 30, tiktok: 15, offline: 28 },
  { day: 'DAY 14', amazon: 80, tiktok: 25, offline: 20 },
  { day: 'DAY 21', amazon: 40, tiktok: 35, offline: 25 },
  { day: 'DAY 28', amazon: 90, tiktok: 45, offline: 15 },
];

export default function App() {
  return (
    <div className="min-h-screen bg-[#f8f5f6] font-sans text-slate-900 pb-10">
      {/* Header */}
      <header className="bg-white border-b border-[#e0001a]/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-[#e0001a]">
            <Aperture size={28} strokeWidth={2.5} />
            <h2 className="text-slate-900 text-lg font-bold tracking-tight uppercase">TIRTIR Shade-Sync</h2>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-[#e0001a] text-sm font-semibold border-b-2 border-[#e0001a] pb-1">Dashboard</a>
            <a href="#" className="text-slate-500 text-sm font-medium hover:text-[#e0001a] transition-colors pb-1">Inventory</a>
            <a href="#" className="text-slate-500 text-sm font-medium hover:text-[#e0001a] transition-colors pb-1">Sales</a>
            <a href="#" className="text-slate-500 text-sm font-medium hover:text-[#e0001a] transition-colors pb-1">Marketing</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search product or shade" className="bg-slate-100 border-none rounded-lg pl-9 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-[#e0001a]/20 outline-none" />
          </div>
          <img src="https://i.pravatar.cc/150?img=32" alt="User" className="w-9 h-9 rounded-full border-2 border-[#e0001a]/20" />
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-xl border border-[#e0001a]/5 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Filters</span>
          <button className="flex items-center gap-2 rounded-lg bg-[#e0001a]/5 border border-[#e0001a]/10 px-4 py-1.5 text-sm font-semibold hover:bg-[#e0001a]/10 transition-colors">
            <span>Country: US, JP, VN</span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-[#e0001a]/5 border border-[#e0001a]/10 px-4 py-1.5 text-sm font-semibold hover:bg-[#e0001a]/10 transition-colors">
            <span>Channel: All Channels</span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-[#e0001a]/5 border border-[#e0001a]/10 px-4 py-1.5 text-sm font-semibold hover:bg-[#e0001a]/10 transition-colors ml-auto">
            <Calendar size={16} />
            <span>Last 30 Days</span>
          </button>
        </div>

        {/* Product Overview */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 flex gap-6 border-r border-slate-100 pr-6">
            <div className="bg-slate-50 rounded-lg h-32 w-32 shrink-0 flex items-center justify-center p-2 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[#e0001a]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-900 shadow-inner flex items-center justify-center text-white/60 text-xs font-bold border border-red-900/20 shadow-xl transform group-hover:scale-105 transition-transform">
                TIRTIR
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-[#e0001a] text-white text-[10px] font-bold px-2 py-0.5 rounded">BESTSELLER</span>
                <span className="text-slate-400 text-xs font-medium uppercase tracking-tighter">SKU: RD-CSN-01</span>
              </div>
              <div className="flex items-center gap-1 group/selector cursor-pointer -ml-1 pl-1 rounded-md hover:bg-slate-50 transition-colors">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mask Fit Red Cushion</h1>
                <ChevronDown size={20} className="text-slate-400 group-hover/selector:text-[#e0001a] transition-colors" />
              </div>
              <p className="text-slate-500 text-sm mt-1">Global Distribution Profile</p>
            </div>
          </div>

          <div className="lg:col-span-4 flex justify-center border-r border-slate-100 pr-6 items-center gap-12 xl:gap-20">
            <div className="space-y-2">
              <p className="text-slate-500 text-sm font-black uppercase tracking-widest">Total Sales</p>
              <p className="text-4xl font-black text-slate-900">$1.2M</p>
              <p className="text-emerald-500 text-sm font-bold flex items-center gap-1">
                <TrendingUp size={16} /> +5.2%
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-slate-500 text-sm font-black uppercase tracking-widest">MoM Growth</p>
              <p className="text-4xl font-black text-[#e0001a]">+15%</p>
              <p className="text-slate-500 text-xs font-semibold">Above target (12%)</p>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-center">
            <p className="text-slate-500 text-sm font-black uppercase tracking-widest mb-3">Top 3 Shades (Revenue)</p>
            <div className="flex gap-3">
              <div className="flex-1 bg-white p-3 rounded-xl text-center border border-slate-100 border-b-4 border-b-[#E7CFB2] shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-2 mb-0.5">
                  <div className="w-3 h-3 rounded-full border border-black/5" style={{ backgroundColor: '#E7CFB2' }}></div>
                  <span className="text-lg font-black text-slate-900">21N</span>
                </div>
                <span className="text-xs font-bold text-slate-500">42%</span>
              </div>
              <div className="flex-1 bg-white p-3 rounded-xl text-center border border-slate-100 border-b-4 border-b-[#DFC4AF] shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-2 mb-0.5">
                  <div className="w-3 h-3 rounded-full border border-black/5" style={{ backgroundColor: '#DFC4AF' }}></div>
                  <span className="text-lg font-black text-slate-900">23N</span>
                </div>
                <span className="text-xs font-bold text-slate-500">28%</span>
              </div>
              <div className="flex-1 bg-white p-3 rounded-xl text-center border border-slate-100 border-b-4 border-b-[#EFDED2] shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-2 mb-0.5">
                  <div className="w-3 h-3 rounded-full border border-black/5" style={{ backgroundColor: '#EFDED2' }}></div>
                  <span className="text-lg font-black text-slate-900">17C</span>
                </div>
                <span className="text-xs font-bold text-slate-500">15%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Heatmap */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <LayoutGrid className="text-[#e0001a]" size={20} />
                45 Shade Heatmap (Sales Intensity)
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <span>Low</span>
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 bg-[#e0001a]/5 rounded-sm"></div>
                  <div className="w-3 h-3 bg-[#e0001a]/20 rounded-sm"></div>
                  <div className="w-3 h-3 bg-[#e0001a]/40 rounded-sm"></div>
                  <div className="w-3 h-3 bg-[#e0001a]/70 rounded-sm"></div>
                  <div className="w-3 h-3 bg-[#e0001a] rounded-sm"></div>
                </div>
                <span>High</span>
              </div>
            </div>
            
            <div className="grid grid-cols-9 gap-2">
              {shades.map((shade) => (
                <div
                  key={shade.name}
                  className={`aspect-square rounded flex flex-col items-center justify-center text-[10px] font-bold ${
                    shade.intensity >= 40 ? 'text-white' : 'text-[#e0001a]/80'
                  } ${
                    shade.intensity === 5 ? 'bg-[#e0001a]/5' :
                    shade.intensity === 20 ? 'bg-[#e0001a]/20' :
                    shade.intensity === 40 ? 'bg-[#e0001a]/40' :
                    shade.intensity === 70 ? 'bg-[#e0001a]/70' :
                    'bg-[#e0001a]'
                  } ${
                    shade.highlight ? 'shadow-lg shadow-[#e0001a]/20 ring-2 ring-[#e0001a] ring-offset-2' : ''
                  }`}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full mb-1 ${shade.intensity >= 40 ? 'border border-white/20' : 'border border-black/5'}`}
                    style={{ backgroundColor: shade.color }}
                  ></div>
                  <span className="text-[9px] font-bold">{shade.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sales Velocity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <LineChartIcon className="text-[#e0001a]" size={20} />
                Sales Velocity: Shade 21N
              </h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#e0001a]"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Amazon</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">TikTok Shop</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Offline</span>
                </div>
              </div>
            </div>
            
            <div className="flex-1 relative min-h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} dy={10} />
                  <Tooltip />
                  <Line type="monotone" dataKey="amazon" stroke="#e0001a" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="tiktok" stroke="#1e293b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="offline" stroke="#94a3b8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 p-3 bg-slate-50 rounded-lg flex justify-between items-center">
              <span className="text-xs font-semibold">Projected Burn Rate</span>
              <span className="text-xs font-black text-[#e0001a]">1,240 units / day</span>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Inventory Alert */}
          <div className="lg:col-span-5 bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="text-[#e0001a]" size={20} />
              Inventory Alert: OOS D-Day
            </h3>
            <div className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="pb-3 px-1">Shade</th>
                    <th className="pb-3 px-1">Inventory</th>
                    <th className="pb-3 px-1">Burn Rate</th>
                    <th className="pb-3 px-1 text-right">D-Day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-1 font-bold">17C Light</td>
                    <td className="py-3 px-1">4,200</td>
                    <td className="py-3 px-1">320/d</td>
                    <td className="py-3 px-1 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-bold text-xs">13 Days</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-1 font-bold">21N Natural</td>
                    <td className="py-3 px-1">12,400</td>
                    <td className="py-3 px-1">540/d</td>
                    <td className="py-3 px-1 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 font-bold text-xs">22 Days</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-1 font-bold">23N Sand</td>
                    <td className="py-3 px-1">8,900</td>
                    <td className="py-3 px-1">310/d</td>
                    <td className="py-3 px-1 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 font-bold text-xs">28 Days</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-1 font-bold">13N Porcelain</td>
                    <td className="py-3 px-1">3,100</td>
                    <td className="py-3 px-1">75/d</td>
                    <td className="py-3 px-1 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xs">41 Days</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Profiling & Action Card */}
          <div className="lg:col-span-7 space-y-6">
            {/* Customer Profiling */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e0001a]/5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">Customer Profiling</h3>
                <div className="flex gap-2">
                  <span className="bg-slate-100 text-[10px] font-bold px-2 py-1 rounded">GLOBAL DATA</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex gap-4 items-center border-r border-slate-100 pr-6">
                  <div className="relative size-20 shrink-0">
                    <svg className="size-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-100" strokeWidth="4" />
                      <circle cx="18" cy="18" r="16" fill="none" className="stroke-[#e0001a]" strokeWidth="4" strokeDasharray="85, 100" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-sm font-black">85%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">Age / Gender</p>
                    <p className="text-sm font-bold">Female, 18-34</p>
                    <div className="flex gap-1">
                      <div className="h-1.5 w-12 bg-[#e0001a] rounded-full"></div>
                      <div className="h-1.5 w-4 bg-slate-200 rounded-full"></div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-center space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase">RFM Segments</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-600">VIP (High Value)</span>
                      <span className="font-bold">2,400 pts</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#e0001a]" style={{ width: '70%' }}></div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-slate-600">At Risk (Lapsed)</span>
                      <span className="font-bold">850 pts</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400" style={{ width: '25%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-slate-900 rounded-xl p-6 shadow-xl border border-white/10 relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#e0001a]/20 blur-3xl -mr-16 -mt-16 rounded-full"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-[#e0001a] flex items-center justify-center">
                      <Megaphone size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#e0001a] tracking-widest uppercase">Smart Recommendation</p>
                      <h4 className="font-bold text-lg">Inventory Optimization Campaign</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase opacity-60">A/B Test</span>
                    <div className="w-8 h-4 bg-white/20 rounded-full relative flex items-center px-0.5 cursor-pointer">
                      <div className="size-3 bg-white rounded-full translate-x-4 transition-transform"></div>
                    </div>
                  </div>
                </div>
                <p className="text-slate-400 text-sm mb-6 max-w-md">
                  Shade <span className="text-white font-bold">17C</span> inventory is moving slower than projected in VN Market. Suggest sending a personalized bundle offer to active VIPs.
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Target</span>
                      <span className="font-bold">1,000 VIPs</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Expected ROI</span>
                      <span className="font-bold text-emerald-400">4.2x</span>
                    </div>
                  </div>
                  <button className="bg-[#e0001a] hover:bg-red-700 transition-colors text-white font-black px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm uppercase tracking-wider">
                    Execute Action
                    <Rocket size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

