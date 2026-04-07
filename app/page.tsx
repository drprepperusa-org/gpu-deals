'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search, Download, ChevronDown, ChevronRight, MessageSquare, Clock,
  Plus, BarChart3, DollarSign, X, Zap, Activity,
  ArrowUpRight, SlidersHorizontal, Cpu, Newspaper, Target, Building2,
  ExternalLink, RefreshCw, Layers, Radio, Hash
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

interface BulkListing {
  id: string; title: string; price: number; pricePerUnit: number;
  quantity: number; gpuModel: string; source: string;
  seller: string; condition: string; link: string; foundAt: string;
}

interface DatacenterLead {
  id: string; company: string; website: string; type: string;
  description: string; location: string; outreachAngle: string;
  status: string; notes: string;
}

interface LogEntry { msg: string; type: string; }

// ─── Dashboard ────────────────────────────────────────────

export default function Dashboard() {
  const [newsDigest, setNewsDigest] = useState('');
  const [leads, setLeads] = useState<DatacenterLead[]>([]);
  const [intelLoaded, setIntelLoaded] = useState(false);
  const [intelLoading, setIntelLoading] = useState(false);

  const [listings, setListings] = useState<BulkListing[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('Idle');

  const [activeTab, setActiveTab] = useState<'deals' | 'leads' | 'news'>('deals');
  const [showFilters, setShowFilters] = useState(false);
  const [filterModel, setFilterModel] = useState('all');
  const [logs, setLogs] = useState<LogEntry[]>([{ msg: 'System online. Ready to scan.', type: 'info' }]);
  const [maxPages, setMaxPages] = useState(2);
  const [excludes, setExcludes] = useState(['broken', 'for parts', 'untested', 'as-is', 'not working', 'damaged', 'empty box', 'box only', 'mining rig frame']);
  const [newExclude, setNewExclude] = useState('');
  const [clock, setClock] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { loadIntel(); }, []);

  function log(msg: string, type = '') {
    setLogs(prev => [...prev.slice(-50), { msg: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' › ' + msg, type }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }

  async function loadIntel() {
    setIntelLoading(true);
    log('Fetching market intel...', 'info');
    try {
      const res = await fetch('/api/intel');
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        setListings(data.listings || []);
        setTotalScanned(data.totalScanned || 0);
        setNewsDigest(data.newsDigest || '');
        setIntelLoaded(true);
        log(`Intel loaded — ${data.listings?.length || 0} listings found`, 'ok');
      } else { log('Intel error: ' + data.error, 'err'); }
    } catch (err) { log('Failed: ' + (err as Error).message, 'err'); }
    setIntelLoading(false);
  }

  async function runScanner() {
    setScanning(true); setScanStatus('Scanning');
    log(`Deep scan: ${maxPages} pages × 8 queries`, 'info');
    try {
      const res = await fetch('/api/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPages, excludeKeywords: excludes }),
      });
      const data = await res.json();
      if (data.success) {
        setListings(data.listings || []);
        setTotalScanned(data.totalScanned || 0);
        log(`Done — ${data.listings?.length || 0} listings from ${data.totalScanned || 0} scanned`, 'ok');
        setScanStatus(`${data.listings?.length || 0} found`);
      } else { log('Error: ' + data.error, 'err'); setScanStatus('Error'); }
    } catch (err) { log('Failed: ' + (err as Error).message, 'err'); setScanStatus('Error'); }
    setScanning(false);
  }

  function exportCSV() {
    if (!listings.length) return;
    const h = ['GPU Model', 'Title', 'Price', 'Qty', 'Per Unit', 'Condition', 'Source', 'Seller', 'Link', 'Found At'];
    const rows = listings.map(d => [d.gpuModel, '"' + d.title.replace(/"/g, '""') + '"', d.price, d.quantity, d.pricePerUnit, d.condition, d.source, d.seller, '"' + d.link + '"', d.foundAt]);
    const blob = new Blob([[h.join(','), ...rows.map(r => r.join(','))].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'gpu-deals-' + new Date().toISOString().slice(0, 10) + '.csv' }).click();
    URL.revokeObjectURL(url);
  }

  function addExclude() {
    const val = newExclude.trim().toLowerCase();
    if (val && !excludes.includes(val)) setExcludes([...excludes, val]);
    setNewExclude('');
  }

  const filteredListings = filterModel === 'all' ? listings : listings.filter(l => l.gpuModel === filterModel);
  const gpuModels = [...new Set(listings.map(l => l.gpuModel))].sort();
  const cheapest = listings.length ? Math.min(...listings.map(l => l.pricePerUnit)) : 0;
  const avgPrice = listings.length ? Math.round(listings.reduce((s, l) => s + l.pricePerUnit, 0) / listings.length) : 0;
  const bulkCount = listings.filter(l => l.quantity > 1).length;

  return (
    <>
      <div className="mesh-bg" />
      <div className="relative z-10 min-h-screen">

        {/* ═══ TOP BAR ═══ */}
        <header className="sticky top-0 z-50 border-b border-dark-border bg-dark-bg/80 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">OpenClaw</span>
              <span className="text-[10px] text-zinc-600 font-mono">GPU MONITOR</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                <Radio className={`w-3 h-3 ${scanning || intelLoading ? 'text-amber-400 animate-pulse' : intelLoaded ? 'text-accent2' : 'text-zinc-600'}`} />
                {scanning ? 'SCANNING' : intelLoaded ? 'LIVE' : 'OFFLINE'}
              </div>
              <div className="h-4 w-px bg-dark-border" />
              <span className="text-[11px] font-mono text-zinc-600">{clock}</span>
              <div className="h-4 w-px bg-dark-border" />
              <button onClick={loadIntel} disabled={intelLoading} className="p-1.5 rounded-lg hover:bg-dark-surface2 text-zinc-500 hover:text-white transition-all">
                <RefreshCw className={`w-3.5 h-3.5 ${intelLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-[1400px] mx-auto px-6 py-6">

          {/* ═══ STATS ROW ═══ */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'LISTINGS', value: listings.length, sub: 'active', icon: Layers, color: 'text-accent' },
              { label: 'SCANNED', value: totalScanned, sub: 'total', icon: Activity, color: 'text-blue-400' },
              { label: 'BEST $/UNIT', value: cheapest ? `$${cheapest.toLocaleString()}` : '—', sub: 'lowest', icon: DollarSign, color: 'text-accent2' },
              { label: 'BULK LOTS', value: bulkCount, sub: `avg $${avgPrice.toLocaleString()}`, icon: Hash, color: 'text-amber-400' },
            ].map((s, i) => (
              <div key={i} className="panel rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold tracking-widest text-zinc-600">{s.label}</span>
                  <s.icon className={`w-3.5 h-3.5 ${s.color} opacity-50`} />
                </div>
                <div className={`text-2xl font-bold text-white tracking-tight count-up`}>{s.value}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ═══ MAIN LAYOUT ═══ */}
          <div className="grid grid-cols-[1fr_320px] gap-6">

            {/* LEFT: Content */}
            <div className="space-y-4">

              {/* Tab Nav */}
              <div className="flex items-center gap-1">
                {[
                  { id: 'deals' as const, label: 'Deal Scanner', icon: Target },
                  { id: 'leads' as const, label: 'DC Leads', icon: Building2 },
                  { id: 'news' as const, label: 'News', icon: Newspaper },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-dark-surface2 border border-transparent'
                    }`}>
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ═══ DEALS TAB ═══ */}
              {activeTab === 'deals' && (
                <div className="space-y-4 fade-in">

                  {/* Controls */}
                  <div className="panel rounded-xl p-5">
                    <div className="flex items-center gap-4">
                      <button onClick={runScanner} disabled={scanning}
                        className="px-6 py-2.5 bg-gradient-to-r from-accent to-indigo-600 hover:from-accent/90 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all glow-btn flex items-center gap-2">
                        {scanning
                          ? <><Clock className="w-3.5 h-3.5 animate-spin" /> Scanning</>
                          : <><Zap className="w-3.5 h-3.5" /> Scan Now</>}
                      </button>
                      <div className="flex-1">
                        <div className="text-xs text-zinc-300 font-medium">{scanStatus}</div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">8 queries · {maxPages} pages · DC decommission focus</div>
                      </div>
                      {listings.length > 0 && (
                        <button onClick={exportCSV} className="px-3 py-2 rounded-lg text-[11px] text-zinc-500 hover:text-white hover:bg-dark-surface2 transition-all flex items-center gap-1.5 border border-dark-border">
                          <Download className="w-3 h-3" /> Export
                        </button>
                      )}
                    </div>
                    {scanning && (
                      <div className="h-0.5 bg-dark-surface2 rounded-full overflow-hidden mt-4">
                        <div className="h-full bg-gradient-to-r from-accent to-accent2 rounded-full animate-pulse" style={{ width: '75%' }} />
                      </div>
                    )}
                  </div>

                  {/* Filters toggle */}
                  <button onClick={() => setShowFilters(!showFilters)}
                    className="w-full panel rounded-xl px-5 py-3 flex items-center justify-between hover:border-dark-border2 transition-all">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-600" />
                      <span className="text-xs text-zinc-400">Filters</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                  </button>

                  {showFilters && (
                    <div className="panel rounded-xl p-5 space-y-5 fade-in">
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-zinc-600 mb-2">EXCLUDE KEYWORDS</div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {excludes.map((kw, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/8 text-rose-400 border border-rose-500/10">
                              {kw}
                              <button onClick={() => setExcludes(excludes.filter((_, j) => j !== i))} className="opacity-40 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input type="text" value={newExclude} onChange={e => setNewExclude(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExclude()} placeholder="Add..."
                            className="px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-[11px] text-zinc-300 outline-none focus:border-accent/50 w-36 transition-colors" />
                          <button onClick={addExclude} className="px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-500 hover:text-white border border-dark-border hover:border-dark-border2 transition-all"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold tracking-widest text-zinc-600 mb-2">PAGES PER QUERY</div>
                        <div className="flex items-center gap-3">
                          <input type="range" min={1} max={5} value={maxPages} onChange={e => setMaxPages(parseInt(e.target.value))} className="flex-1 accent-accent h-0.5" />
                          <span className="text-xs font-mono text-zinc-400 w-6 text-right">{maxPages}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Results */}
                  {listings.length > 0 ? (
                    <div className="panel rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-dark-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{filteredListings.length}</span>
                          <span className="text-[10px] text-zinc-600">listings</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setFilterModel('all')}
                            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${filterModel === 'all' ? 'bg-accent/10 text-accent' : 'text-zinc-600 hover:text-zinc-300'}`}>All</button>
                          {gpuModels.map(m => (
                            <button key={m} onClick={() => setFilterModel(m)}
                              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${filterModel === m ? 'bg-accent/10 text-accent' : 'text-zinc-600 hover:text-zinc-300'}`}>{m}</button>
                          ))}
                        </div>
                      </div>
                      <div className="max-h-[520px] overflow-y-auto scrollbar-thin">
                        {filteredListings.map((d) => {
                          const cl = (d.condition || '').toLowerCase();
                          const condColor = cl.includes('new') && !cl.includes('pre-owned') ? 'text-emerald-400 bg-emerald-500/8' : cl.includes('refurb') ? 'text-amber-400 bg-amber-500/8' : 'text-blue-400 bg-blue-500/8';
                          return (
                            <a key={d.id} href={d.link} target="_blank" rel="noreferrer"
                              className="flex items-center gap-4 px-5 py-3 border-b border-dark-border/50 hover:bg-white/[0.015] transition-colors group">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/8 text-accent border border-accent/10">{d.gpuModel}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${condColor}`}>{d.condition || 'N/A'}</span>
                                  {d.quantity > 1 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/8 text-amber-400">{d.quantity}×</span>}
                                </div>
                                <p className="text-xs text-zinc-300 truncate group-hover:text-white transition-colors">{d.title}</p>
                                <p className="text-[10px] text-zinc-600 mt-0.5">{d.seller}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-bold text-white">${d.price.toLocaleString()}</div>
                                {d.quantity > 1 && <div className="text-[10px] text-accent2">${d.pricePerUnit}/ea</div>}
                              </div>
                              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-accent transition-colors shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ) : !scanning ? (
                    <div className="panel rounded-xl py-20 text-center">
                      <div className="w-12 h-12 rounded-xl bg-dark-surface2 flex items-center justify-center mx-auto mb-4">
                        <Search className="w-5 h-5 text-zinc-700" />
                      </div>
                      <p className="text-xs text-zinc-600">Hit <span className="text-accent font-semibold">Scan Now</span> to find GPU deals</p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* ═══ LEADS TAB ═══ */}
              {activeTab === 'leads' && (
                <div className="space-y-3 fade-in">
                  {leads.map((lead) => (
                    <div key={lead.id} className="panel rounded-xl p-5 group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{lead.company}</h3>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            lead.type === 'ITAD' ? 'bg-blue-500/8 text-blue-400' :
                            lead.type === 'Liquidator' ? 'bg-amber-500/8 text-amber-400' :
                            'bg-accent/8 text-accent'
                          }`}>{lead.type}</span>
                        </div>
                        <a href={`https://${lead.website}`} target="_blank" rel="noreferrer" className="text-[10px] text-zinc-600 hover:text-accent flex items-center gap-1 transition-colors">
                          {lead.website} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">{lead.description}</p>
                      <div className="p-3 rounded-lg bg-accent/[0.03] border border-accent/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Target className="w-3 h-3 text-accent" />
                          <span className="text-[10px] font-bold text-accent">OUTREACH</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">{lead.outreachAngle}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-[10px] text-zinc-600">
                        <span>📍 {lead.location}</span>
                        {lead.notes && <span className="truncate">💡 {lead.notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ═══ NEWS TAB ═══ */}
              {activeTab === 'news' && (
                <div className="fade-in">
                  {newsDigest ? (
                    <div className="panel rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Newspaper className="w-4 h-4 text-accent" />
                        <span className="text-xs font-bold text-white">GPU Market News</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent2/8 text-accent2 font-bold">LIVE</span>
                      </div>
                      <div className="text-[13px] text-zinc-400 leading-relaxed whitespace-pre-line">{newsDigest}</div>
                    </div>
                  ) : intelLoading ? (
                    <div className="panel rounded-xl p-16 text-center">
                      <RefreshCw className="w-6 h-6 text-accent mx-auto mb-3 animate-spin" />
                      <p className="text-xs text-zinc-500">Loading news...</p>
                    </div>
                  ) : (
                    <div className="panel rounded-xl p-16 text-center">
                      <Newspaper className="w-6 h-6 text-zinc-700 mx-auto mb-3" />
                      <p className="text-xs text-zinc-600">Refresh to load latest GPU news</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: Sidebar */}
            <div className="space-y-4">

              {/* Discord Status */}
              <div className="panel-solid rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] font-bold tracking-widest text-zinc-500">DISCORD FEED</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent2 pulse-ring text-accent2" />
                  <span className="text-xs text-zinc-400">Auto-posting every cycle</span>
                </div>
              </div>

              {/* Quick Leads */}
              <div className="panel-solid rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[10px] font-bold tracking-widest text-zinc-500">TOP LEADS</span>
                  </div>
                  <button onClick={() => setActiveTab('leads')} className="text-[10px] text-accent hover:text-accent/80 transition-colors">View all</button>
                </div>
                <div className="space-y-2">
                  {leads.slice(0, 4).map(l => (
                    <a key={l.id} href={`https://${l.website}`} target="_blank" rel="noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-dark-surface2 transition-colors group">
                      <div className="min-w-0">
                        <div className="text-xs text-zinc-300 font-medium truncate group-hover:text-white transition-colors">{l.company}</div>
                        <div className="text-[10px] text-zinc-600">{l.type} · {l.location}</div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-accent transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Top Models */}
              {listings.length > 0 && (
                <div className="panel-solid rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[10px] font-bold tracking-widest text-zinc-500">BY MODEL</span>
                  </div>
                  <div className="space-y-1.5">
                    {gpuModels.map(m => {
                      const count = listings.filter(l => l.gpuModel === m).length;
                      const pct = Math.round((count / listings.length) * 100);
                      return (
                        <div key={m} className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 w-20 truncate">{m}</span>
                          <div className="flex-1 h-1 bg-dark-border rounded-full overflow-hidden">
                            <div className="h-full bg-accent/40 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-zinc-600 w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Activity Log */}
              <div className="panel-solid rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-dark-border flex items-center gap-2">
                  <Activity className="w-3 h-3 text-zinc-600" />
                  <span className="text-[10px] font-bold tracking-widest text-zinc-600">LOG</span>
                </div>
                <div ref={logRef} className="px-4 py-2 font-mono text-[10px] max-h-40 overflow-y-auto scrollbar-thin space-y-0.5">
                  {logs.map((l, i) => (
                    <div key={i} className={
                      l.type === 'ok' ? 'text-accent2' :
                      l.type === 'err' ? 'text-rose-400' :
                      l.type === 'info' ? 'text-blue-400/60' : 'text-zinc-700'
                    }>{l.msg}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8 pb-6">
            <span className="text-[10px] text-zinc-800 font-mono">OPENCLAW GPU MONITOR v1.0</span>
          </div>
        </div>
      </div>
    </>
  );
}
