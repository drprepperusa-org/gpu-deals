import type { BulkListing } from './types';

/**
 * Analyze new listings from real scraped data.
 */
export function analyzeNewListings(newListings: BulkListing[]): string {
  if (!newListings.length) return '';

  const bulkCount = newListings.filter(l => l.quantity > 1).length;
  const models = [...new Set(newListings.map(l => l.gpuModel))];
  const cheapest = newListings.reduce((min, l) => l.pricePerUnit < min.pricePerUnit ? l : min, newListings[0]);

  const dcKeywords = ['datacenter', 'data center', 'server pull', 'decommission', 'enterprise', 'liquidation'];
  const dcListings = newListings.filter(l => dcKeywords.some(kw => l.title.toLowerCase().includes(kw)));

  const lines: string[] = [];
  if (dcListings.length > 0) lines.push(`🏢 **${dcListings.length} datacenter/enterprise listings** detected`);
  if (bulkCount > 0) lines.push(`📦 **${bulkCount} bulk lot${bulkCount > 1 ? 's' : ''}** available`);
  lines.push(`💰 Best per-unit: **${cheapest.gpuModel}** at **$${cheapest.pricePerUnit.toLocaleString()}/unit** — "${cheapest.title.slice(0, 55)}"`);
  lines.push(`📊 Models: ${models.join(', ')}`);

  return lines.join('\n');
}
