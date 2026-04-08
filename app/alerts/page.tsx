'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cpu, AlertTriangle, ArrowLeft, RefreshCw, Radio,
  ExternalLink, Filter, Clock,
} from 'lucide-react';

interface AlertItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string;
  priority: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  bulk_lot: 'Bulk Lot',
  high_value_gpu: 'Datacenter GPU',
  price_drop: 'Below Market',
  new_company: 'New Company',
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-rose-500/8 border-rose-500/15', text: 'text-rose-400', label: 'URGENT' },
  high: { bg: 'bg-amber-500/8 border-amber-500/15', text: 'text-amber-400', label: 'HIGH' },
  medium: { bg: 'bg-blue-500/8 border-blue-500/15', text: 'text-blue-400', label: 'MEDIUM' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [days, setDays] = useState(7);
  const router = useRouter();

  useEffect(() => { fetchAlerts(); }, [filter, days]);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts?days=${days}&type=${filter}`);
      const data = await res.json();
      if (data.success) setAlerts(data.alerts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const urgentCount = alerts.filter(a => a.priority === 'urgent').length;
  const highCount = alerts.filter(a => a.priority === 'high').length;

  return (
    <>
      <div className="mesh-bg" />
      <div className="relative z-10 min-h-screen">

        {/* ═══ TOP BAR ═══ */}
        <header className="sticky top-0 z-50 border-b border-dark-border bg-dark-bg/80 backdrop-blur-xl">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => router.push('/')} className="p-1.5 cursor-pointer rounded-lg hover:bg-dark-surface2 text-zinc-500 hover:text-white transition-all">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">Alerts</span>
              {urgentCount > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">{urgentCount} URGENT</span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
                <Radio className={`w-3 h-3 ${loading ? 'text-amber-400 animate-pulse' : 'text-accent2'}`} />
                {alerts.length} alerts
              </div>
              <button onClick={fetchAlerts} disabled={loading} className="p-1.5 cursor-pointer rounded-lg hover:bg-dark-surface2 text-zinc-500 hover:text-white transition-all">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading && (
            <div className="h-0.5 bg-dark-surface2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 rounded-full loading-bar" />
            </div>
          )}
        </header>

        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 sm:py-6">

          {/* ═══ STATS ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
            {[
              { label: 'TOTAL', value: alerts.length, color: 'text-zinc-400' },
              { label: 'URGENT', value: urgentCount, color: 'text-rose-400' },
              { label: 'HIGH', value: highCount, color: 'text-amber-400' },
              { label: 'MEDIUM', value: alerts.length - urgentCount - highCount, color: 'text-blue-400' },
            ].map((s, i) => (
              <div key={i} className="panel rounded-xl p-4 fade-in" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="text-[10px] font-bold tracking-widest text-zinc-600">{s.label}</span>
                <div className={`text-2xl font-bold tracking-tight mt-1 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* ═══ FILTERS ═══ */}
          <div className="panel rounded-xl p-4 mb-4 flex items-center gap-3 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-zinc-600" />

            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="px-3 py-2 cursor-pointer bg-dark-bg border border-dark-border rounded-lg text-xs text-zinc-300 outline-none focus:border-accent/50 transition-colors">
              <option value="all">All Types</option>
              <option value="bulk_lot">Bulk Lots</option>
              <option value="high_value_gpu">Datacenter GPUs</option>
              <option value="price_drop">Below Market</option>
              <option value="new_company">New Companies</option>
            </select>

            <select value={days} onChange={e => setDays(parseInt(e.target.value))}
              className="px-3 py-2 cursor-pointer bg-dark-bg border border-dark-border rounded-lg text-xs text-zinc-300 outline-none focus:border-accent/50 transition-colors">
              <option value={1}>Today</option>
              <option value={3}>Last 3 Days</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>

          {/* ═══ ALERTS LIST ═══ */}
          <div className="space-y-2">
            {loading && alerts.length === 0 && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="panel rounded-xl p-5">
                    <div className="shimmer h-4 w-32 rounded mb-2" />
                    <div className="shimmer h-4 w-full rounded mb-2" />
                    <div className="shimmer h-3 w-48 rounded" />
                  </div>
                ))}
              </div>
            )}

            {!loading && alerts.length === 0 && (
              <div className="panel rounded-xl py-16 text-center fade-in">
                <div className="w-12 h-12 rounded-xl bg-dark-surface2 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-5 h-5 text-zinc-700" />
                </div>
                <p className="text-xs text-zinc-600">No alerts found for this period</p>
              </div>
            )}

            {alerts.map((alert, i) => {
              const style = PRIORITY_STYLES[alert.priority] || PRIORITY_STYLES.medium;
              const typeLabel = TYPE_LABELS[alert.type] || alert.type;

              return (
                <a key={alert.id} href={alert.link?.startsWith('http') ? alert.link : `https://${alert.link}`}
                  target="_blank" rel="noreferrer"
                  className={`panel rounded-xl px-4 sm:px-5 py-4 border ${style.bg} hover:border-dark-border2 transition-all group block fade-in`}
                  style={{ animationDelay: `${i * 40}ms` }}>

                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text} border`}>{style.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-surface2 text-zinc-500">{typeLabel}</span>
                        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                      <p className="text-sm text-white font-medium mb-1 group-hover:text-accent transition-colors">
                        {alert.title}
                      </p>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        {alert.message}
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-700 group-hover:text-accent transition-colors shrink-0 mt-2" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
