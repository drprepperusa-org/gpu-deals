/**
 * GPU Market Intelligence Engine — DJ Command Center style.
 * Generates detailed market reports from scraped data.
 * Algorithmic analysis — no AI API needed.
 * Can plug in Gemini/Claude later for enhanced reports.
 */

import type { GpuListing, CompanyLead, MarketIntel } from './types';

// ─── Market data & thresholds ────────────────────────────

const MARKET_PRICES: Record<string, { new: number; used: number; bulk: number }> = {
  'RTX 5090': { new: 2999, used: 2400, bulk: 2000 },
  'RTX 5080': { new: 1299, used: 1000, bulk: 850 },
  'RTX 4090': { new: 2200, used: 1800, bulk: 1200 },
  'RTX 4080': { new: 1200, used: 900, bulk: 700 },
  'RTX 4070': { new: 600, used: 450, bulk: 350 },
  'RTX 3090': { new: 900, used: 600, bulk: 400 },
  'RTX 3080': { new: 500, used: 350, bulk: 250 },
  'H100': { new: 30000, used: 20000, bulk: 15000 },
  'H200': { new: 40000, used: 30000, bulk: 25000 },
  'A100': { new: 12000, used: 6000, bulk: 4000 },
  'A6000': { new: 4000, used: 2500, bulk: 1800 },
  'L40': { new: 7000, used: 5000, bulk: 3500 },
  'V100': { new: 2000, used: 800, bulk: 500 },
};

// ─── Generate Market Intel ───────────────────────────────

export function generateIntel(opts: {
  listings: GpuListing[];
  leads: CompanyLead[];
}): MarketIntel[] {
  const intel: MarketIntel[] = [];
  const now = new Date().toISOString();
  const { listings, leads } = opts;

  if (!listings.length && !leads.length) return intel;

  // Model pricing analysis
  const modelData: Record<string, { prices: number[]; count: number; listings: GpuListing[] }> = {};
  for (const l of listings) {
    if (!modelData[l.gpuModel]) modelData[l.gpuModel] = { prices: [], count: 0, listings: [] };
    modelData[l.gpuModel].count++;
    modelData[l.gpuModel].listings.push(l);
    if (l.pricePerUnit > 0) modelData[l.gpuModel].prices.push(l.pricePerUnit);
  }

  // Per-model market analysis
  for (const [model, data] of Object.entries(modelData)) {
    if (data.prices.length === 0) continue;
    const min = Math.min(...data.prices);
    const max = Math.max(...data.prices);
    const avg = Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length);
    const market = MARKET_PRICES[model];

    let analysis = `${model}: ${data.count} listings found. `;
    if (data.prices.length > 0) {
      analysis += `Price range: $${min.toLocaleString()}–$${max.toLocaleString()}/unit (avg $${avg.toLocaleString()}). `;
    }
    if (market) {
      const vsUsed = Math.round(((avg - market.used) / market.used) * 100);
      if (vsUsed < -15) analysis += `BELOW MARKET — ${Math.abs(vsUsed)}% under used market ($${market.used.toLocaleString()}). Strong buy signal.`;
      else if (vsUsed > 15) analysis += `ABOVE MARKET — ${vsUsed}% over used market. Wait for better pricing.`;
      else analysis += `AT MARKET — within range of used market ($${market.used.toLocaleString()}).`;
    }

    intel.push({ timestamp: now, finding: analysis, sourceLink: data.listings[0]?.link || '' });
  }

  // Bulk lot detection
  const bulkLots = listings.filter(l => l.quantity >= 4);
  if (bulkLots.length > 0) {
    const totalUnits = bulkLots.reduce((s, l) => s + l.quantity, 0);
    const models = [...new Set(bulkLots.map(l => l.gpuModel))];
    intel.push({
      timestamp: now,
      finding: `BULK ALERT: ${bulkLots.length} bulk lot${bulkLots.length > 1 ? 's' : ''} detected — ${totalUnits} total units. Models: ${models.join(', ')}. Largest lot: ${Math.max(...bulkLots.map(l => l.quantity))} units. Bulk lots = highest-margin acquisition targets.`,
      sourceLink: bulkLots[0].link,
    });
  }

  // Datacenter/enterprise signal
  const dcListings = listings.filter(l => {
    const t = l.title.toLowerCase();
    return t.includes('datacenter') || t.includes('data center') || t.includes('server pull') ||
      t.includes('decommission') || t.includes('enterprise') || t.includes('liquidation');
  });
  if (dcListings.length > 0) {
    intel.push({
      timestamp: now,
      finding: `DATACENTER SIGNAL: ${dcListings.length} enterprise/datacenter listing${dcListings.length > 1 ? 's' : ''} spotted. This may indicate a decommission cycle starting. Average price: $${Math.round(dcListings.filter(l => l.pricePerUnit > 0).reduce((s, l) => s + l.pricePerUnit, 0) / (dcListings.filter(l => l.pricePerUnit > 0).length || 1)).toLocaleString()}/unit.`,
      sourceLink: dcListings[0].link,
    });
  }

  // High-priority leads
  const highLeads = leads.filter(l => l.priority === 'High');
  if (highLeads.length > 0) {
    for (const lead of highLeads.slice(0, 3)) {
      intel.push({
        timestamp: now,
        finding: `NEW LEAD: ${lead.company} (${lead.type}) — ${lead.description.slice(0, 120)}. GPUs: ${lead.gpuModels}. Location: ${lead.location}.`,
        sourceLink: lead.website,
      });
    }
  }

  return intel;
}

// ─── Market Signal ───────────────────────────────────────

export function getMarketSignal(listings: GpuListing[]): {
  signal: string;
  reasoning: string;
} {
  if (listings.length === 0) return { signal: 'NO DATA', reasoning: 'Insufficient data for market signal.' };

  let buySignals = 0;
  let sellSignals = 0;

  // Check pricing vs market
  for (const l of listings) {
    if (l.pricePerUnit <= 0) continue;
    const market = MARKET_PRICES[l.gpuModel];
    if (!market) continue;
    if (l.pricePerUnit < market.bulk) buySignals += 2; // Below bulk price = strong buy
    else if (l.pricePerUnit < market.used * 0.85) buySignals += 1; // 15%+ below used
    else if (l.pricePerUnit > market.used * 1.15) sellSignals += 1; // 15%+ above used
  }

  // Bulk lots = buy pressure
  const bulkCount = listings.filter(l => l.quantity >= 4).length;
  buySignals += bulkCount * 2;

  // DC decommission = supply increasing = sell pressure
  const dcCount = listings.filter(l => {
    const t = l.title.toLowerCase();
    return t.includes('decommission') || t.includes('liquidation') || t.includes('surplus');
  }).length;
  sellSignals += dcCount;

  const score = buySignals - sellSignals;
  if (score >= 4) return { signal: 'STRONG BUY', reasoning: `${buySignals} buy signals detected. Bulk lots and below-market pricing indicate acquisition window.` };
  if (score >= 2) return { signal: 'BUY', reasoning: `Favorable pricing detected. ${bulkCount} bulk lot${bulkCount !== 1 ? 's' : ''} available.` };
  if (score <= -3) return { signal: 'SELL', reasoning: `${sellSignals} sell signals. Decommission/liquidation activity suggests supply increase incoming.` };
  if (score <= -1) return { signal: 'HOLD → SELL', reasoning: `Market softening. Monitor weekly for price erosion.` };
  return { signal: 'HOLD', reasoning: `Market stable. No urgent action needed. Continue monitoring for bulk opportunities.` };
}

// ─── Action Item ─────────────────────────────────────────

export function getActionItem(listings: GpuListing[], leads: CompanyLead[]): string {
  const bulkLots = listings.filter(l => l.quantity >= 4);
  const dcListings = listings.filter(l => {
    const t = l.title.toLowerCase();
    return t.includes('datacenter') || t.includes('decommission') || t.includes('liquidation');
  });
  const highLeads = leads.filter(l => l.priority === 'High');

  const items: string[] = [];

  if (dcListings.length >= 3) {
    items.push(`${dcListings.length} datacenter listings found — review bulk lots and contact sellers for volume pricing. DC decommission waves = highest-margin opportunity.`);
  }

  if (bulkLots.length > 0) {
    const bestBulk = bulkLots[0];
    items.push(`${bulkLots.length} bulk lot${bulkLots.length > 1 ? 's' : ''} spotted (${bulkLots.reduce((s, l) => s + l.quantity, 0)} total units). Best: ${bestBulk.gpuModel} × ${bestBulk.quantity} @ $${bestBulk.pricePerUnit > 0 ? bestBulk.pricePerUnit.toLocaleString() + '/unit' : 'TBD'}. Act fast — bulk lots move quickly.`);
  }

  if (highLeads.length > 0) {
    items.push(`${highLeads.length} high-priority GPU supplier${highLeads.length > 1 ? 's' : ''} found. Cold outreach recommended: "${highLeads[0].company}" — inquire about bulk GPU inventory from recent decommissions.`);
  }

  // Below-market pricing
  const deals = listings.filter(l => {
    if (l.pricePerUnit <= 0) return false;
    const market = MARKET_PRICES[l.gpuModel];
    return market && l.pricePerUnit < market.used * 0.85;
  });
  if (deals.length > 0) {
    items.push(`${deals.length} below-market deal${deals.length > 1 ? 's' : ''} detected. Best: ${deals[0].gpuModel} at $${deals[0].pricePerUnit.toLocaleString()}/unit (market: $${MARKET_PRICES[deals[0].gpuModel]?.used.toLocaleString()}).`);
  }

  if (items.length === 0) {
    items.push('No major bulk or DC lots this cycle. Continue monitoring — decommission waves are cyclical. Scout BidSpotter + Liquidation.com daily for datacenter bulk drops.');
  }

  return items.join('\n• ');
}

// ─── Full DJ-Style Discord Report ────────────────────────

export function generateFullReport(opts: {
  listings: GpuListing[];
  leads: CompanyLead[];
  totalScanned: number;
  sources: Record<string, number>;
}): string {
  const { listings, leads, totalScanned, sources } = opts;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const lines: string[] = [];

  lines.push(`🖥️ **GPU Intel Drop — ${dateStr}**`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // ── Market Pulse
  lines.push(`**📊 Market Pulse**`);

  const modelData: Record<string, { prices: number[]; count: number }> = {};
  for (const l of listings) {
    if (!modelData[l.gpuModel]) modelData[l.gpuModel] = { prices: [], count: 0 };
    modelData[l.gpuModel].count++;
    if (l.pricePerUnit > 0) modelData[l.gpuModel].prices.push(l.pricePerUnit);
  }

  const sortedModels = Object.entries(modelData).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  for (const [model, data] of sortedModels) {
    if (data.prices.length > 0) {
      const min = Math.min(...data.prices);
      const max = Math.max(...data.prices);
      const market = MARKET_PRICES[model];
      let trend = '';
      if (market) {
        const avg = Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length);
        if (avg < market.used * 0.85) trend = ' 📉 Below market';
        else if (avg > market.used * 1.15) trend = ' 📈 Above market';
        else trend = ' ➡️ At market';
      }
      const range = min === max ? `$${min.toLocaleString()}` : `$${min.toLocaleString()}–$${max.toLocaleString()}`;
      lines.push(`• **${model}**: ${range}/unit (${data.count} listings)${trend}`);
    } else {
      lines.push(`• **${model}**: Price TBD (${data.count} listings)`);
    }
  }

  const bulkCount = listings.filter(l => l.quantity > 1).length;
  lines.push(`• ${listings.length} total listings from ${totalScanned} scanned`);
  if (bulkCount > 0) lines.push(`• **${bulkCount} bulk lot${bulkCount > 1 ? 's' : ''}** detected`);

  const activeSources = Object.entries(sources).filter(([, v]) => v > 0).map(([k]) => k);
  if (activeSources.length > 0) lines.push(`• Sources: ${activeSources.join(', ')}`);
  lines.push('');

  // ── Notable Lots
  const highlights = listings.filter(l => l.quantity > 1 || l.score >= 50).slice(0, 5);
  if (highlights.length > 0) {
    lines.push(`**🔍 Notable GPU Lots**`);
    for (const d of highlights) {
      const qty = d.quantity > 1 ? `${d.quantity}x @ $${d.pricePerUnit > 0 ? d.pricePerUnit.toLocaleString() + '/ea' : 'TBD'}` : `$${d.price > 0 ? d.price.toLocaleString() : 'TBD'}`;
      lines.push(`• **${d.gpuModel}** — ${qty} | ${d.condition} | ${d.seller}`);
      lines.push(`  ${d.title.slice(0, 80)}`);
      lines.push(`  ${d.link}`);
    }
    lines.push('');
  }

  // ── Market Signal
  const { signal, reasoning } = getMarketSignal(listings);
  lines.push(`**📌 Market Signal: ${signal}**`);
  lines.push(reasoning);
  lines.push('');

  // ── Action Items
  const actionItem = getActionItem(listings, leads);
  lines.push(`**⚡ Action Items**`);
  lines.push(`• ${actionItem}`);
  lines.push('');

  // ── Company Leads
  if (leads.length > 0) {
    lines.push(`**🏢 GPU Supplier Leads (${leads.length})**`);
    for (const lead of leads.slice(0, 5)) {
      const priority = lead.priority === 'High' ? '🔴' : lead.priority === 'Medium' ? '🟡' : '🟢';
      lines.push(`${priority} **${lead.company}** (${lead.type})`);
      lines.push(`• ${lead.description.slice(0, 120)}`);
      lines.push(`• GPUs: ${lead.gpuModels} · ${lead.location}`);
      if (lead.type === 'ITAD' || lead.type === 'Liquidator' || lead.type === 'Wholesale') {
        lines.push(`• Outreach: "We're acquiring bulk GPUs for AI workload resale — can you alert us to upcoming inventory?"`);
      }
      const url = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`;
      lines.push(`• ${url}`);
      lines.push('');
    }
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🕐 ${timeStr} · Next scan: tomorrow at noon`);

  return lines.join('\n');
}
