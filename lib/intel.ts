/**
 * Generate market intelligence analysis from scraped data.
 * Algorithmic — no LLM needed.
 */

import type { GpuListing, CompanyLead, MarketIntel } from './types';

export function generateIntel(opts: {
  listings: GpuListing[];
  leads: CompanyLead[];
}): MarketIntel[] {
  const intel: MarketIntel[] = [];
  const now = new Date().toISOString();
  const { listings, leads } = opts;

  // Best deal found
  if (listings.length > 0) {
    const best = listings[0]; // Already sorted by score
    intel.push({
      timestamp: now,
      finding: `Top GPU deal: ${best.gpuModel} at $${best.pricePerUnit.toLocaleString()}/unit (${best.quantity}x, ${best.condition}) from ${best.source}. Score: ${best.score}.`,
      sourceLink: best.link,
    });
  }

  // Bulk lot detection
  const bulkLots = listings.filter(l => l.quantity >= 5);
  if (bulkLots.length > 0) {
    intel.push({
      timestamp: now,
      finding: `${bulkLots.length} bulk lots detected (5+ units). Models: ${[...new Set(bulkLots.map(l => l.gpuModel))].join(', ')}. Largest: ${Math.max(...bulkLots.map(l => l.quantity))} units.`,
      sourceLink: bulkLots[0].link,
    });
  }

  // Datacenter decommission signals
  const dcListings = listings.filter(l => {
    const t = l.title.toLowerCase();
    return t.includes('datacenter') || t.includes('data center') || t.includes('server pull') || t.includes('decommission') || t.includes('enterprise');
  });
  if (dcListings.length > 0) {
    intel.push({
      timestamp: now,
      finding: `${dcListings.length} datacenter/enterprise listings spotted — potential decommission wave. Average price: $${Math.round(dcListings.reduce((s, l) => s + l.pricePerUnit, 0) / dcListings.length).toLocaleString()}/unit.`,
      sourceLink: dcListings[0].link,
    });
  }

  // Price analysis by model
  const modelPrices: Record<string, number[]> = {};
  for (const l of listings) {
    if (!modelPrices[l.gpuModel]) modelPrices[l.gpuModel] = [];
    modelPrices[l.gpuModel].push(l.pricePerUnit);
  }
  const topModels = Object.entries(modelPrices)
    .filter(([, prices]) => prices.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  for (const [model, prices] of topModels) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    intel.push({
      timestamp: now,
      finding: `${model} market: $${min.toLocaleString()}–$${max.toLocaleString()}/unit (avg $${avg.toLocaleString()}, ${prices.length} listings).`,
      sourceLink: '',
    });
  }

  // High-priority leads
  const highLeads = leads.filter(l => l.priority === 'High');
  if (highLeads.length > 0) {
    intel.push({
      timestamp: now,
      finding: `${highLeads.length} high-priority GPU supplier${highLeads.length > 1 ? 's' : ''} found: ${highLeads.map(l => `${l.company} (${l.type})`).join(', ')}.`,
      sourceLink: highLeads[0].website ? `https://${highLeads[0].website}` : '',
    });
  }


  return intel;
}

/**
 * Generate the action item based on findings.
 */
export function getActionItem(listings: GpuListing[], leads: CompanyLead[]): string {
  const dcListings = listings.filter(l => {
    const t = l.title.toLowerCase();
    return t.includes('datacenter') || t.includes('decommission') || t.includes('liquidation');
  });

  if (dcListings.length >= 3) {
    return `${dcListings.length} datacenter listings found. Review bulk lots and contact sellers for volume pricing. DC decommission waves = highest-margin opportunities.`;
  }

  const bulkLots = listings.filter(l => l.quantity >= 5);
  if (bulkLots.length > 0) {
    return `${bulkLots.length} bulk lots spotted. Monitor sellers for restocks. Set alerts for quantity listings from high-feedback sellers.`;
  }

  if (leads.filter(l => l.priority === 'High').length > 0) {
    return `New high-priority GPU suppliers found. Reach out to ITAD/liquidation contacts — inquire about bulk GPU inventory from recent decommissions.`;
  }

  return `No major bulk or DC lots this cycle. Continue monitoring — decommission waves are cyclical. Focus outreach on ITAD contacts.`;
}
