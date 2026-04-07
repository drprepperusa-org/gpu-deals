'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search, Download, ChevronDown, ChevronUp, MessageSquare, Clock,
  Plus, BarChart3, DollarSign, TrendingDown, X,
  ArrowUpRight, SlidersHorizontal, Cpu, Newspaper, Target, Building2,
  Signal, ExternalLink, RefreshCw, Zap
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

interface BulkListing {
  id: string;
  title: string;
  price: number;
  pricePerUnit: number;
  quantity: number;
  gpuModel: string;
  source: string;
  seller: string;
  condition: string;
  link: string;
  foundAt: string;
}

interface DatacenterLead {
  id: string;
  company: string;
  website: string;
  type: string;
  description: string;
  location: string;
  outreachAngle: string;
  status: string;
  notes: string;
}

interface IntelData {
  marketPulse: string;
  bestFind: string;
  actionItems: string;
  signal: string;
}

interface LogEntry {
  msg: string;
  type: string;
}

// ─── Component ────────────────────────────────────────────

export default function CommandCenter() {
  // Intel state
  const [newsDigest, setNewsDigest] = useState('');
  const [intel, setIntel] = useState<IntelData | null>(null);
  const [leads, setLeads] = useState<DatacenterLead[]>([]);
  const [intelLoaded, setIntelLoaded] = useState(false);
  const [intelLoading, setIntelLoading] = useState(false);

  // Scanner state
  const [listings, setListings] = useState<BulkListing[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Ready');

  // UI state
  const [activeTab, setActiveTab] = useState<'deals' | 'leads' | 'news'>('deals');
  const [showFilters, setShowFilters] = useState(false);
  const [filterModel, setFilterModel] = useState('all');
  const [logs, setLogs] = useState<LogEntry[]>([{ msg: 'Command Center initialized.', type: 'info' }]);
  const [maxPages, setMaxPages] = useState(2);
  const [excludes, setExcludes] = useState(['broken', 'for parts', 'untested', 'as-is', 'not working', 'damaged', 'empty box', 'box only', 'mining rig frame']);
  const [newExclude, setNewExclude] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadIntel();
  }, []);

  function log(msg: string, type = '') {
    setLogs(prev => [...prev, { msg: new Date().toLocaleTimeString() + '  ' + msg, type }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }

  async function loadIntel() {
    setIntelLoading(true);
    log('Loading live market intel...', 'info');
    try {
      const res = await fetch('/api/intel');
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        setListings(data.listings || []);
        setTotalScanned(data.totalScanned || 0);
        setNewsDigest(data.newsDigest || '');
        setIntel(data.intel || null);
        setIntelLoaded(true);
        log(`Intel loaded — ${data.listings?.length || 0} listings, ${data.totalScanned || 0} scanned`, 'ok');
      } else {
        log('Intel error: ' + data.error, 'err');
      }
    } catch (err) {
      log('Failed to load intel: ' + (err as Error).message, 'err');
    }
    setIntelLoading(false);
  }

  async function runScanner() {
    setScanning(true);
    setScanStatus('Scanning...');
    log(`Deep scan: ${maxPages} pages across rotated queries...`, 'info');
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPages, excludeKeywords: excludes }),
      });
      const data = await res.json();
      if (data.success) {
        setListings(data.listings || []);
        setTotalScanned(data.totalScanned || 0);
        log(`Found ${data.listings?.length || 0} listings from ${data.totalScanned || 0} scanned`, 'ok');
        setScanStatus(`${data.listings?.length || 0} deals found`);
      } else {
        log('Scan error: ' + data.error, 'err');
        setScanStatus('Error');
      }
    } catch (err) {
      log('Scan failed: ' + (err as Error).message, 'err');
      setScanStatus('Error');
    }
    setScanning(false);
  }

  function exportCSV() {
    if (!listings.length) return;
    const h = ['GPU Model', 'Title', 'Price', 'Qty', 'Per Unit', 'Condition', 'Source', 'Seller', 'Link', 'Found At'];
    const rows = listings.map(d => [
      d.gpuModel, '"' + d.title.replace(/"/g, '""') + '"',
      d.price, d.quantity, d.pricePerUnit, d.condition, d.source, d.seller,
      '"' + d.link + '"', d.foundAt,
    ]);
    const blob = new Blob([[h.join(','), ...rows.map(r => r.join(','))].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'gpu-intel-' + new Date().toISOString().slice(0, 10) + '.csv' }).click();
    URL.revokeObjectURL(url);
  }

  function addExclude() {
    const val = newExclude.trim().toLowerCase();
    if (val && !excludes.includes(val)) setExcludes([...excludes, val]);
    setNewExclude('');
  }

  const filteredListings = filterModel === 'all' ? listings : listings.filter(l => l.gpuModel === filterModel);
  const gpuModels = [...new Set(listings.map(l => l.gpuModel))].sort();
  const cheapest = listings.length ? '$' + Math.min(...listings.map(l => l.pricePerUnit)).toLocaleString() : '--';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Parse signal keyword from AI text
  const signalText = intel?.signal || '';
  const signalIsBuy = signalText.toUpperCase().includes('BUY');
  const signalIsHold = signalText.toUpperCase().includes('HOLD');
  const signalColor = signalIsBuy ? 'emerald' : signalIsHold ? 'amber' : 'red';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">

      {/* ═══ HEADER ═══ */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">OpenClaw GPU Scanner</h1>
            <p className="text-xs text-gray-500 mt-0.5">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadIntel} disabled={intelLoading} className="p-2 rounded-xl glass glass-hover text-gray-500 hover:text-white transition-all" title="Refresh Intel">
            <RefreshCw className={`w-3.5 h-3.5 ${intelLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5">
            <MessageSquare className="w-3 h-3 text-gray-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            scanning || intelLoading ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
            intelLoaded ? 'bg-emerald-500/10 text-emerald-400' : 'glass text-gray-400'
          }`}>
            {scanning ? 'Scanning' : intelLoading ? 'Loading' : intelLoaded ? 'Live' : 'Offline'}
          </div>
        </div>
      </header>

      {/* ═══ MARKET SIGNAL BANNER ═══ */}
      {intel?.signal && (
        <div className={`rounded-2xl p-5 mb-6 border fade-in bg-${signalColor}-500/5 border-${signalColor}-500/20`}>
          <div className="flex items-start gap-4">
            <div className={`p-2.5 rounded-xl bg-${signalColor}-500/10`}>
              <Signal className={`w-5 h-5 text-${signalColor}-400`} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{intel.signal}</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB NAV ═══ */}
      <div className="flex items-center gap-1 mb-6 glass rounded-xl p-1">
        {[
          { id: 'deals' as const, label: 'Deal Scanner', icon: Target },
          { id: 'leads' as const, label: 'DC Leads', icon: Building2 },
          { id: 'news' as const, label: 'Market News', icon: Newspaper },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${
              activeTab === tab.id ? 'bg-violet-600/20 text-violet-400 border border-violet-500/20' : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ DEAL SCANNER TAB ═══ */}
      {activeTab === 'deals' && (
        <div className="space-y-6 fade-in">
          {/* Run Controls */}
          <section className="glass rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button onClick={runScanner} disabled={scanning}
                className="px-10 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center gap-2.5 text-sm glow-btn">
                {scanning
                  ? <span className="flex items-center gap-2"><Clock className="w-4 h-4 animate-spin" /> Scanning...</span>
                  : <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Scan for Deals</span>}
              </button>
              <div className="flex-1">
                <p className="text-sm text-gray-300 font-medium">{scanStatus}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">8 rotated queries · Max {maxPages} pages · DC decommission focus</p>
              </div>
              {listings.length > 0 && (
                <button onClick={exportCSV} className="px-4 py-2.5 glass glass-hover rounded-xl text-xs text-gray-400 hover:text-white transition-all flex items-center gap-1.5 font-medium">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              )}
            </div>
            {scanning && <div className="h-1 bg-dark-surface2 rounded-full overflow-hidden mt-5"><div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full animate-pulse" style={{ width: '80%' }} /></div>}
          </section>

          {/* Filters */}
          <button onClick={() => setShowFilters(!showFilters)}
            className="w-full glass glass-hover rounded-2xl px-6 py-4 flex items-center justify-between transition-all">
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-300">Scan Settings</span>
            </div>
            {showFilters ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
          {showFilters && (
            <div className="glass rounded-2xl p-6 space-y-6 fade-in">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Exclude Keywords</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {excludes.map((kw, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/15">
                      {kw}
                      <button onClick={() => setExcludes(excludes.filter((_, j) => j !== i))} className="opacity-40 hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newExclude} onChange={e => setNewExclude(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExclude()} placeholder="Add keyword..."
                    className="px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-xs text-gray-200 outline-none focus:border-violet-500 w-44 transition-colors" />
                  <button onClick={addExclude} className="px-3 py-2 glass glass-hover rounded-xl text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-all"><Plus className="w-3 h-3" /> Add</button>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Max Pages per Query</h3>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={5} value={maxPages} onChange={e => setMaxPages(parseInt(e.target.value))} className="flex-1 accent-violet-500 h-1" />
                  <span className="text-sm font-bold text-gray-300 min-w-[40px] text-right">{maxPages}</span>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {listings.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { v: listings.length, l: 'Deals Found', c: 'text-emerald-400', Icon: TrendingDown },
                { v: totalScanned, l: 'Scanned', c: 'text-blue-400', Icon: BarChart3 },
                { v: cheapest, l: 'Best $/Unit', c: 'text-violet-400', Icon: DollarSign },
              ].map((s, i) => (
                <div key={i} className="stat-glow glass rounded-2xl p-5 text-center">
                  <s.Icon className={`w-5 h-5 mx-auto mb-2 ${s.c} opacity-70`} />
                  <div className={`text-2xl font-bold ${s.c} tracking-tight`}>{s.v}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-semibold">{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Results Table */}
          {listings.length > 0 ? (
            <section className="glass rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-sm font-semibold text-white">{filteredListings.length} Listings</h2>
                <div className="flex items-center gap-1 flex-wrap">
                  <button onClick={() => setFilterModel('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterModel === 'all' ? 'bg-violet-600/20 text-violet-400 border border-violet-500/20' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>All</button>
                  {gpuModels.map(m => (
                    <button key={m} onClick={() => setFilterModel(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterModel === m ? 'bg-violet-600/20 text-violet-400 border border-violet-500/20' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/[0.02] sticky top-0 z-10 backdrop-blur-sm">
                      <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">GPU</th>
                      <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Title</th>
                      <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Price</th>
                      <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Qty</th>
                      <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">$/Unit</th>
                      <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-500">Condition</th>
                      <th className="px-5 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredListings.map((d) => {
                      const cl = (d.condition || '').toLowerCase();
                      const condColor = cl.includes('new') && !cl.includes('pre-owned') ? 'text-emerald-400 bg-emerald-500/10' : cl.includes('refurb') ? 'text-amber-400 bg-amber-500/10' : 'text-blue-400 bg-blue-500/10';
                      return (
                        <tr key={d.id} className="hover:bg-white/[0.02] border-t border-white/[0.03] transition-colors group">
                          <td className="px-5 py-3.5"><span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/10">{d.gpuModel}</span></td>
                          <td className="px-5 py-3.5 max-w-[350px]">
                            <a href={d.link} target="_blank" rel="noreferrer" className="text-gray-200 hover:text-violet-400 transition-colors" title={d.title}>
                              {d.title.length > 60 ? d.title.slice(0, 57) + '...' : d.title}
                            </a>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-emerald-400 whitespace-nowrap">${d.price.toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-gray-400">{d.quantity > 1 ? `${d.quantity}x` : '1'}</td>
                          <td className="px-5 py-3.5 font-semibold text-white whitespace-nowrap">${d.pricePerUnit.toLocaleString()}</td>
                          <td className="px-5 py-3.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${condColor}`}>{d.condition || 'N/A'}</span></td>
                          <td className="px-5 py-3.5">
                            <a href={d.link} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-violet-400 transition-all">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : !scanning ? (
            <section className="glass rounded-2xl p-20 text-center">
              <Search className="w-8 h-8 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Hit <strong className="text-violet-400">Scan for Deals</strong> to search for bulk GPU listings.</p>
            </section>
          ) : null}
        </div>
      )}

      {/* ═══ LEADS TAB ═══ */}
      {activeTab === 'leads' && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center gap-2.5 mb-2">
            <Building2 className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Datacenter Decommission Leads</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-semibold">{leads.length}</span>
          </div>

          {leads.map((lead) => (
            <div key={lead.id} className="glass rounded-2xl p-6 hover:border-violet-500/20 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-white">{lead.company}</h3>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${
                    lead.type === 'ITAD' ? 'bg-blue-500/10 text-blue-400' :
                    lead.type === 'Liquidator' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-violet-500/10 text-violet-400'
                  }`}>{lead.type}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    lead.status === 'new' ? 'bg-emerald-500/10 text-emerald-400' :
                    lead.status === 'contacted' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>{lead.status.toUpperCase()}</span>
                </div>
                <a href={`https://${lead.website}`} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-violet-400 transition-colors flex items-center gap-1 text-xs">
                  {lead.website} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-sm text-gray-400 mb-3">{lead.description}</p>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
                <Target className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-violet-400 mb-0.5">Outreach Angle</p>
                  <p className="text-xs text-gray-400">{lead.outreachAngle}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-600">
                <span>📍 {lead.location}</span>
                {lead.notes && <span>💡 {lead.notes}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ NEWS TAB ═══ */}
      {activeTab === 'news' && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center gap-2.5 mb-2">
            <Newspaper className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">GPU Industry News — {today}</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">AI-GENERATED</span>
          </div>

          {newsDigest ? (
            <section className="glass rounded-2xl p-6">
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{newsDigest}</p>
            </section>
          ) : intelLoading ? (
            <section className="glass rounded-2xl p-16 text-center">
              <RefreshCw className="w-8 h-8 text-violet-400 mx-auto mb-3 animate-spin" />
              <p className="text-gray-400 text-sm">Generating news digest with Gemini AI...</p>
            </section>
          ) : (
            <section className="glass rounded-2xl p-16 text-center">
              <Newspaper className="w-8 h-8 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Click refresh in the header to load live news.</p>
            </section>
          )}
        </div>
      )}

      {/* ═══ ACTIVITY LOG ═══ */}
      <div className="glass rounded-2xl overflow-hidden mt-6">
        <div className="px-6 py-3 border-b border-white/5">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Activity Log</h2>
        </div>
        <div ref={logRef} className="px-5 py-3 font-mono text-[11px] max-h-32 overflow-y-auto space-y-0.5 scrollbar-thin">
          {logs.map((l, i) => (
            <div key={i} className={l.type === 'ok' ? 'text-emerald-400' : l.type === 'err' ? 'text-red-400' : l.type === 'info' ? 'text-blue-400/70' : 'text-gray-600'}>{l.msg}</div>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-700 mt-8 font-medium tracking-wide">OpenClaw GPU Scanner v1.0 — Discord updates every 2 min</p>
    </div>
  );
}
