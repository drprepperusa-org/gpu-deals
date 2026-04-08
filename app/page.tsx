'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cpu, Activity, RefreshCw, Radio, Clock,
  Bell, BellOff, Search, Building2, Target,
} from 'lucide-react';
import type { GpuListing, CompanyLead } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────

interface LogEntry { msg: string; type: string; }

interface CronResult {
  success: boolean;
  listings: number;
  listingsData: GpuListing[];
  leads: number;
  leadsData: CompanyLead[];
  intelItems: number;
  actionItem: string;
  scanned: number;
  sources: Record<string, number>;
  error?: string;
}

// ─── Skeleton Components ─────────────────────────────────

function StatSkeleton() {
  return (
    <div className="panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="shimmer h-3 w-16 rounded" />
        <div className="shimmer h-3.5 w-3.5 rounded" />
      </div>
      <div className="shimmer h-7 w-10 rounded mb-1" />
      <div className="shimmer h-2.5 w-24 rounded" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="panel rounded-xl px-4 sm:px-5 py-3 sm:py-4">
      <div className="shimmer h-4 w-full rounded mb-2" />
      <div className="shimmer h-4 w-3/4 rounded mb-3" />
      <div className="flex items-center gap-2">
        <div className="shimmer h-2.5 w-20 rounded" />
        <div className="shimmer h-2.5 w-12 rounded" />
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="panel-solid rounded-xl p-4">
        <div className="shimmer h-3 w-20 rounded mb-3" />
        <div className="shimmer h-3 w-36 rounded mb-2" />
        <div className="shimmer h-2.5 w-28 rounded" />
      </div>
      <div className="panel-solid rounded-xl p-4">
        <div className="shimmer h-3 w-24 rounded mb-3" />
        <div className="shimmer h-3 w-32 rounded" />
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────

export default function Dashboard() {
  const [listings, setListings] = useState<GpuListing[]>([]);
  const [leads, setLeads] = useState<CompanyLead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const [totalScanned, setTotalScanned] = useState(0);
  const [sources, setSources] = useState<Record<string, number>>({});
  const [clock, setClock] = useState('');
  const [timeRange, setTimeRange] = useState<'today' | '3d' | 'week'>('today');
  const [isLocal, setIsLocal] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([{ msg: 'System online. Ready to scan.', type: 'info' }]);
  const [discordEnabled, setDiscordEnabled] = useState(true);
  const [togglingDiscord, setTogglingDiscord] = useState(false);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function loadDiscordSetting() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) setDiscordEnabled(data.discordEnabled);
    } catch { /* ignore */ }
  }

  function handleToggleDiscord() {
    if (discordEnabled) {
      setShowDiscordModal(true);
    } else {
      toggleDiscord(true);
    }
  }

  async function toggleDiscord(newVal: boolean) {
    setShowDiscordModal(false);
    setTogglingDiscord(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordEnabled: newVal }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscordEnabled(newVal);
        log(`Discord alerts ${newVal ? 'enabled' : 'paused'}`, newVal ? 'ok' : 'info');
      }
    } catch {
      log('Failed to update Discord setting', 'err');
    }
    setTogglingDiscord(false);
  }

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    loadDiscordSetting();
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setIsLocal(local);
    // On Vercel: auto-load results from Supabase
    if (!local) loadResults();
  }, []);

  async function loadResults() {
    setScanning(true);
    log('Loading latest GPU deals from database...', 'info');
    try {
      const res = await fetch('/api/results?days=7');
      const data = await res.json();
      if (data.success) {
        setListings(data.listingsData || []);
        setLeads(data.leadsData || []);
        setLoaded(true);
        log(`Loaded ${data.listings} listings, ${data.leads} leads`, 'ok');
      } else {
        log('Error: ' + (data.error || 'Failed to load'), 'err');
      }
    } catch (err) {
      log('Failed: ' + (err as Error).message, 'err');
    }
    setScanning(false);
  }

  function log(msg: string, type = '') {
    setLogs(prev => [...prev.slice(-50), { msg: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' › ' + msg, type }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }

  async function runScan() {
    setScanning(true);
    // loading handled by scanning state
    log('Scanning for GPU deals across all sources...', 'info');
    try {
      const res = await fetch(`/api/scan?range=${timeRange}`);
      const data: CronResult = await res.json();
      if (data.success) {
        setTotalScanned(data.scanned);
        setSources(data.sources || {});
        setLastScan(new Date().toISOString());
        setLoaded(true);

        // Fetch the actual listings data
        setListings(data.listingsData || []);
        setLeads(data.leadsData || []);
        const activeSources = Object.entries(data.sources || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ');
        log(`Scan complete — ${data.listings} listings, ${data.leads} leads, ${data.scanned} scanned`, 'ok');
        if (activeSources) log(`Sources: ${activeSources}`, 'info');
        if (data.listings === 0 && data.leads === 0) log('No GPU deals found this cycle', 'info');
      } else {
        log('Error: ' + (data.error || 'Scan failed'), 'err');
      }
    } catch (err) {
      log('Failed: ' + (err as Error).message, 'err');
    }
    setScanning(false);
    // scanning state handles loading
  }

  const bulkCount = listings.filter(l => l.quantity > 1).length;
  const highLeads = leads.filter(l => l.priority === 'High').length;

  return (
    <>
      <div className="mesh-bg" />
      <div className="relative z-10 min-h-screen">

        {/* ═══ TOP BAR ═══ */}
        <header className="sticky top-0 z-50 border-b border-dark-border bg-dark-bg/80 backdrop-blur-xl">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">GPU Deals</span>
              <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">INTEL MONITOR</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] font-mono text-zinc-500">
                <Radio className={`w-3 h-3 ${scanning ? 'text-amber-400 animate-pulse' : loaded ? 'text-accent2' : 'text-zinc-600'}`} />
                {scanning ? 'SCANNING' : loaded ? 'READY' : 'IDLE'}
              </div>
              <div className="h-4 w-px bg-dark-border hidden sm:block" />
              <span className="text-[11px] font-mono text-zinc-600 hidden sm:inline">{clock}</span>
              <div className="h-4 w-px bg-dark-border" />
              <button onClick={handleLogout} className="px-2.5 py-1.5 cursor-pointer rounded-lg hover:bg-dark-surface2 text-[11px] font-medium text-zinc-500 hover:text-rose-400 transition-all">
                Logout
              </button>
            </div>
          </div>

          {scanning && (
            <div className="h-0.5 bg-dark-surface2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent via-accent2 to-accent rounded-full loading-bar" />
            </div>
          )}
        </header>

        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 sm:py-6">

          {/* ═══ STATS ROW ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {scanning && !loaded ? (
              <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
            ) : (
              [{
                label: 'GPU LISTINGS', value: listings.length, sub: `${totalScanned} scanned`, icon: Target, color: 'text-accent',
              }, {
                label: 'BULK LOTS', value: bulkCount, sub: 'multi-unit deals', icon: Search, color: 'text-emerald-400',
              }, {
                label: 'LEADS', value: leads.length, sub: `${highLeads} high priority`, icon: Building2, color: 'text-blue-400',
              }, {
                label: 'SOURCES', value: Object.values(sources).filter(v => v > 0).length, sub: `of ${Object.keys(sources).length} active`, icon: Activity, color: 'text-amber-400',
              }].map((s, i) => (
                <div key={i} className="panel rounded-xl p-4 fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold tracking-widest text-zinc-600">{s.label}</span>
                    <s.icon className={`w-3.5 h-3.5 ${s.color} opacity-50`} />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight count-up">{s.value}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{s.sub}</div>
                </div>
              ))
            )}
          </div>

          {/* ═══ MAIN LAYOUT ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 sm:gap-6">

            {/* LEFT: Content */}
            <div className="space-y-4">

              {/* Scan Button (local) or Status (Vercel) */}
              {isLocal ? (
                <div className="panel rounded-xl p-5">
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <button onClick={runScan} disabled={scanning}
                      className="px-6 py-2.5 cursor-pointer bg-gradient-to-r from-accent to-indigo-600 hover:from-accent/90 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all glow-btn flex items-center gap-2">
                      {scanning
                        ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
                        : <><Search className="w-3.5 h-3.5" /> Scan</>}
                    </button>
                    <select
                      value={timeRange}
                      onChange={e => setTimeRange(e.target.value as 'today' | '3d' | 'week')}
                      disabled={scanning}
                      className="px-3 py-2.5 cursor-pointer bg-dark-bg border border-dark-border rounded-lg text-xs text-zinc-300 outline-none focus:border-accent/50 transition-colors"
                    >
                      <option value="today">Today</option>
                      <option value="3d">Last 3 Days</option>
                      <option value="week">Last 7 Days</option>
                    </select>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 font-medium">{loaded ? `${listings.length} deals found` : 'Ready to scan'}</div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">Reddit · eBay · Google · Swappa · BidSpotter · HiBid · GovDeals · Craigslist</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="panel rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                      <Cpu className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-300 font-medium">Scans run automatically from your local machine</div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">Scheduled daily at 12:00 PM · Results posted to Discord + Google Sheets</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading skeleton */}
              {scanning && !loaded && (
                <div className="space-y-4">
                  <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
              )}

              {/* GPU Listings */}
              {!scanning && listings.length > 0 && (
                <div className="fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold text-white">GPU Deals Found</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/8 text-accent font-bold">{listings.length}</span>
                  </div>
                  <div className="space-y-2">
                    {listings.map((l, i) => (
                      <a key={i} href={l.link} target="_blank" rel="noreferrer"
                        className="panel rounded-xl px-4 sm:px-5 py-3 sm:py-4 flex items-start justify-between hover:border-dark-border2 transition-all group fade-in"
                        style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="flex-1 min-w-0 mr-2 sm:mr-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/8 text-accent border border-accent/10">{l.gpuModel}</span>
                            {l.quantity > 1 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/8 text-amber-400">{l.quantity}x</span>}
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-surface2 text-zinc-500">{l.source}</span>
                          </div>
                          <p className="text-xs sm:text-[13px] text-zinc-300 font-medium leading-snug group-hover:text-white transition-colors">
                            {l.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                            <span className="font-medium">{l.seller}</span>
                            <span>·</span>
                            <span>{l.condition}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {l.price > 0 && <div className="text-sm font-bold text-white">${l.price.toLocaleString()}</div>}
                          {l.quantity > 1 && l.pricePerUnit > 0 && <div className="text-[10px] text-accent2">${l.pricePerUnit}/ea</div>}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Company Leads */}
              {!scanning && leads.length > 0 && (
                <div className="fade-in" style={{ animationDelay: '150ms' }}>
                  <div className="flex items-center gap-2 mb-3 mt-6">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white">GPU Supplier Leads</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/8 text-blue-400 font-bold">{leads.length}</span>
                  </div>
                  <div className="space-y-2">
                    {leads.map((l, i) => (
                      <a key={i} href={`https://${l.website}`} target="_blank" rel="noreferrer"
                        className="panel rounded-xl px-4 sm:px-5 py-3 sm:py-4 hover:border-dark-border2 transition-all group block fade-in"
                        style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${l.priority === 'High' ? 'bg-rose-500/8 text-rose-400' : l.priority === 'Medium' ? 'bg-amber-500/8 text-amber-400' : 'bg-emerald-500/8 text-emerald-400'}`}>{l.priority}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-surface2 text-zinc-500">{l.type}</span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-zinc-300 font-medium group-hover:text-white transition-colors">{l.company}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-600">
                          <span>{l.location}</span>
                          <span>·</span>
                          <span>GPUs: {l.gpuModels}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!scanning && loaded && listings.length === 0 && leads.length === 0 && (
                <div className="panel rounded-xl py-16 text-center fade-in">
                  <div className="w-12 h-12 rounded-xl bg-dark-surface2 flex items-center justify-center mx-auto mb-4">
                    <Search className="w-5 h-5 text-zinc-700" />
                  </div>
                  <p className="text-xs text-zinc-600">No GPU deals or leads found this scan. Try again later.</p>
                </div>
              )}

              {/* Initial state */}
              {!scanning && !loaded && (
                <div className="panel rounded-xl py-16 text-center fade-in">
                  <div className="w-12 h-12 rounded-xl bg-dark-surface2 flex items-center justify-center mx-auto mb-4">
                    <Target className="w-5 h-5 text-zinc-700" />
                  </div>
                  {isLocal
                    ? <p className="text-xs text-zinc-600">Hit <span className="text-accent font-semibold">Scan</span> to start searching</p>
                    : <p className="text-xs text-zinc-600">Scans run automatically from your local machine at noon daily</p>
                  }
                </div>
              )}
            </div>

            {/* RIGHT: Sidebar */}
            {scanning && !loaded ? (
              <SidebarSkeleton />
            ) : (
              <div className="space-y-4 fade-in" style={{ animationDelay: '200ms' }}>

                {/* Discord Status */}
                <div className="panel-solid rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {discordEnabled ? <Bell className="w-3.5 h-3.5 text-accent" /> : <BellOff className="w-3.5 h-3.5 text-zinc-600" />}
                      <span className="text-[10px] font-bold tracking-widest text-zinc-500">DISCORD</span>
                    </div>
                    <button
                      onClick={handleToggleDiscord}
                      disabled={togglingDiscord}
                      className={`relative cursor-pointer w-9 h-5 rounded-full transition-colors ${discordEnabled ? 'bg-accent2' : 'bg-dark-border2'} ${togglingDiscord ? 'opacity-50' : ''}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${discordEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${discordEnabled ? 'bg-accent2 pulse-ring text-accent2' : 'bg-zinc-600'}`} />
                    <span className="text-xs text-zinc-400">{discordEnabled ? 'Auto-posting daily at noon' : 'Alerts paused'}</span>
                  </div>
                  {discordEnabled && <div className="text-[10px] text-zinc-600 mt-2">Next: 12:00 PM UTC</div>}
                </div>

                {/* Last Scan */}
                {lastScan && (
                  <div className="panel-solid rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-zinc-600" />
                      <span className="text-[10px] font-bold tracking-widest text-zinc-500">LAST SCAN</span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(lastScan).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                )}

                {/* Sources */}
                {Object.keys(sources).length > 0 && (
                  <div className="panel-solid rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-3.5 h-3.5 text-zinc-600" />
                      <span className="text-[10px] font-bold tracking-widest text-zinc-500">SOURCES</span>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(sources).map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-500">{name}</span>
                          <span className={`text-[11px] font-mono ${count > 0 ? 'text-accent2' : 'text-zinc-700'}`}>{count}</span>
                        </div>
                      ))}
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
            )}
          </div>

          <div className="text-center mt-8 pb-6">
            <span className="text-[10px] text-zinc-800 font-mono">GPU DEALS v3.0</span>
          </div>
        </div>

        {/* ═══ DISCORD DISABLE MODAL ═══ */}
        {showDiscordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-dark-bg/70 backdrop-blur-sm" onClick={() => setShowDiscordModal(false)} />
            <div className="relative panel rounded-xl p-6 w-full max-w-sm fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <BellOff className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pause Discord Alerts?</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">You won&apos;t receive GPU deals in Discord</p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                The daily cron job will still run, but no messages will be sent to your Discord channel. You can re-enable alerts anytime.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowDiscordModal(false)}
                  className="flex-1 cursor-pointer px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 border border-dark-border hover:border-dark-border2 hover:text-white transition-all">
                  Cancel
                </button>
                <button onClick={() => toggleDiscord(false)}
                  className="flex-1 cursor-pointer px-4 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-all">
                  Yes, Pause Alerts
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
