'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Newspaper, Clock, Cpu, Activity, RefreshCw, Radio,
  TrendingDown, Monitor, BrainCircuit, ExternalLink, Bell, BellOff,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

interface NewsItem {
  headline: string;
  source: string;
  link: string;
  time: string;
  publishedAt: number;
}

interface LogEntry { msg: string; type: string; }

// ─── Categorize news ─────────────────────────────────────

function categorize(news: NewsItem[]) {
  const price: NewsItem[] = [];
  const industry: NewsItem[] = [];
  const ai: NewsItem[] = [];

  for (const n of news) {
    const h = n.headline.toLowerCase();
    if (h.includes('price') || h.includes('drop') || h.includes('deal') || h.includes('sale') || h.includes('discount') || h.includes('msrp') || h.includes('cheap') || h.includes('restock') || h.includes('stock') || h.includes('availability')) {
      price.push(n);
    } else if (h.includes('ai ') || h.includes('datacenter') || h.includes('data center') || h.includes('cloud') || h.includes('h100') || h.includes('h200') || h.includes('b200') || h.includes('inference') || h.includes('training')) {
      ai.push(n);
    } else {
      industry.push(n);
    }
  }

  return { price, industry, ai };
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

function NewsCardSkeleton() {
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
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [lastScraped, setLastScraped] = useState('');
  const [clock, setClock] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([{ msg: 'System online. Ready to fetch news.', type: 'info' }]);
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
      // Disabling — show confirmation modal
      setShowDiscordModal(true);
    } else {
      // Re-enabling — no confirmation needed
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

  useEffect(() => { fetchNews(); loadDiscordSetting(); }, []);

  function log(msg: string, type = '') {
    setLogs(prev => [...prev.slice(-50), { msg: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' › ' + msg, type }]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }

  async function fetchNews() {
    setLoading(true);
    log('Fetching GPU news from Google News...', 'info');
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (data.success) {
        setNews(data.news || []);
        setLastScraped(data.scrapedAt || '');
        setLoaded(true);
        log(`Loaded ${data.news?.length || 0} headlines`, 'ok');
      } else {
        log('Error: ' + data.error, 'err');
      }
    } catch (err) {
      log('Failed: ' + (err as Error).message, 'err');
    }
    setLoading(false);
  }

  const { price, industry, ai } = categorize(news);

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
              <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">GPU NEWS</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] font-mono text-zinc-500">
                <Radio className={`w-3 h-3 ${loading ? 'text-amber-400 animate-pulse' : loaded ? 'text-accent2' : 'text-zinc-600'}`} />
                {loading ? 'FETCHING' : loaded ? 'LIVE' : 'OFFLINE'}
              </div>
              <div className="h-4 w-px bg-dark-border hidden sm:block" />
              <span className="text-[11px] font-mono text-zinc-600 hidden sm:inline">{clock}</span>
              <div className="h-4 w-px bg-dark-border" />
              <button onClick={fetchNews} disabled={loading} className="p-1.5 cursor-pointer rounded-lg hover:bg-dark-surface2 text-zinc-500 hover:text-white transition-all">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={handleLogout} className="px-2.5 py-1.5 cursor-pointer rounded-lg hover:bg-dark-surface2 text-[11px] font-medium text-zinc-500 hover:text-rose-400 transition-all">
                Logout
              </button>
            </div>
          </div>

          {/* Loading progress bar */}
          {loading && (
            <div className="h-0.5 bg-dark-surface2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent via-accent2 to-accent rounded-full loading-bar" />
            </div>
          )}
        </header>

        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 sm:py-6">

          {/* ═══ STATS ROW ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {loading && !loaded ? (
              <>
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </>
            ) : (
              [{
                label: 'HEADLINES', value: news.length, sub: 'from Google News', icon: Newspaper, color: 'text-accent',
              }, {
                label: 'PRICE NEWS', value: price.length, sub: 'deals & drops', icon: TrendingDown, color: 'text-emerald-400',
              }, {
                label: 'INDUSTRY', value: industry.length, sub: 'launches & reviews', icon: Monitor, color: 'text-blue-400',
              }, {
                label: 'AI & DC', value: ai.length, sub: 'datacenter & AI', icon: BrainCircuit, color: 'text-amber-400',
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

            {/* LEFT: News */}
            <div className="space-y-4">

              {/* Loading skeleton */}
              {loading && !loaded && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="shimmer h-4 w-4 rounded" />
                    <div className="shimmer h-4 w-32 rounded" />
                  </div>
                  <NewsCardSkeleton />
                  <NewsCardSkeleton />
                  <NewsCardSkeleton />
                  <div className="flex items-center gap-2 mb-3 mt-6">
                    <div className="shimmer h-4 w-4 rounded" />
                    <div className="shimmer h-4 w-36 rounded" />
                  </div>
                  <NewsCardSkeleton />
                  <NewsCardSkeleton />
                </div>
              )}

              {/* Price & Deals */}
              {!loading && price.length > 0 && (
                <div className="fade-in">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">GPU Prices & Deals</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/8 text-emerald-400 font-bold">LIVE</span>
                  </div>
                  <div className="space-y-2">
                    {price.map((n, i) => <NewsCard key={`p-${i}`} item={n} delay={i * 60} />)}
                  </div>
                </div>
              )}

              {/* Industry */}
              {!loading && industry.length > 0 && (
                <div className="fade-in" style={{ animationDelay: '150ms' }}>
                  <div className="flex items-center gap-2 mb-3 mt-6">
                    <Monitor className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-white">Industry & Launches</span>
                  </div>
                  <div className="space-y-2">
                    {industry.map((n, i) => <NewsCard key={`i-${i}`} item={n} delay={i * 60} />)}
                  </div>
                </div>
              )}

              {/* AI & Datacenter */}
              {!loading && ai.length > 0 && (
                <div className="fade-in" style={{ animationDelay: '300ms' }}>
                  <div className="flex items-center gap-2 mb-3 mt-6">
                    <BrainCircuit className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">AI & Datacenter</span>
                  </div>
                  <div className="space-y-2">
                    {ai.map((n, i) => <NewsCard key={`a-${i}`} item={n} delay={i * 60} />)}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!loading && loaded && news.length === 0 && (
                <div className="panel rounded-xl py-20 text-center fade-in">
                  <div className="w-12 h-12 rounded-xl bg-dark-surface2 flex items-center justify-center mx-auto mb-4">
                    <Newspaper className="w-5 h-5 text-zinc-700" />
                  </div>
                  <p className="text-xs text-zinc-600">No news yet. Hit refresh to fetch latest GPU headlines.</p>
                </div>
              )}
            </div>

            {/* RIGHT: Sidebar */}
            {loading && !loaded ? (
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

                {/* Last Scraped */}
                {lastScraped && (
                  <div className="panel-solid rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-zinc-600" />
                      <span className="text-[10px] font-bold tracking-widest text-zinc-500">LAST SCRAPED</span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(lastScraped).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
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
            <span className="text-[10px] text-zinc-800 font-mono">GPU DEALS v2.0</span>
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
                  <p className="text-[11px] text-zinc-500 mt-0.5">You won&apos;t receive GPU news in Discord</p>
                </div>
              </div>

              <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                The daily cron job will still run, but no messages will be sent to your Discord channel. You can re-enable alerts anytime.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDiscordModal(false)}
                  className="flex-1 cursor-pointer px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 border border-dark-border hover:border-dark-border2 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => toggleDiscord(false)}
                  className="flex-1 cursor-pointer px-4 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-all"
                >
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

// ─── News Card Component ─────────────────────────────────

function NewsCard({ item, delay = 0 }: { item: NewsItem; delay?: number }) {
  return (
    <a href={item.link} target="_blank" rel="noreferrer"
      className="panel rounded-xl px-4 sm:px-5 py-3 sm:py-4 flex items-start justify-between hover:border-dark-border2 transition-all group fade-in"
      style={{ animationDelay: `${delay}ms` }}>
      <div className="flex-1 min-w-0 mr-2 sm:mr-3">
        <p className="text-xs sm:text-[13px] text-zinc-300 font-medium leading-snug group-hover:text-white transition-colors">
          {item.headline}
        </p>
        <div className="flex items-center gap-2 mt-1.5 sm:mt-2 text-[10px] text-zinc-600">
          <span className="font-medium">{item.source}</span>
          {item.time && <><span>·</span><span>{item.time}</span></>}
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-zinc-700 group-hover:text-accent transition-colors shrink-0 mt-1" />
    </a>
  );
}
