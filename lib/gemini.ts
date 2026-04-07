import type { BulkListing } from './types';
import type { PriceDrop } from './price-tracker';

interface NewsItem {
  headline: string;
  source: string;
  link: string;
  time: string;
}

/**
 * Generate a clean, short AI-style market summary from real data.
 * No LLM API needed — pure algorithmic analysis.
 * Can be swapped for Gemini/Claude API call later.
 */
export function generateMarketSummary(opts: {
  listings: BulkListing[];
  priceDrops: PriceDrop[];
  news: NewsItem[];
  totalScanned: number;
}): string {
  const { listings, priceDrops, news, totalScanned } = opts;
  if (!listings.length) return 'No GPU listings found this scan cycle.';

  const lines: string[] = [];

  // Overall market read
  const models = [...new Set(listings.map(l => l.gpuModel))];
  const bulkCount = listings.filter(l => l.quantity > 1).length;
  const avgPrice = Math.round(listings.reduce((s, l) => s + l.pricePerUnit, 0) / listings.length);

  lines.push(`Scanned **${totalScanned.toLocaleString()}** listings across eBay. Found **${listings.length}** GPU deals across **${models.length}** models.`);

  // Price movement
  if (priceDrops.length > 0) {
    const topDrop = priceDrops[0];
    lines.push(`**${topDrop.gpuModel}** leads price drops at **-${topDrop.dropPercent}%** ($${topDrop.previousPrice.toLocaleString()} → $${topDrop.currentPrice.toLocaleString()}/unit).`);
    if (priceDrops.length > 1) {
      const otherModels = [...new Set(priceDrops.slice(1).map(d => d.gpuModel))].slice(0, 3);
      lines.push(`Also dropping: ${otherModels.join(', ')}.`);
    }
  } else {
    lines.push(`Prices are **holding steady** across all tracked models. Average per-unit: $${avgPrice.toLocaleString()}.`);
  }

  // Supply signal
  if (bulkCount > 0) {
    lines.push(`**${bulkCount}** bulk lot${bulkCount > 1 ? 's' : ''} detected — supply is flowing.`);
  }

  // Top model
  const modelCounts = new Map<string, number>();
  for (const l of listings) modelCounts.set(l.gpuModel, (modelCounts.get(l.gpuModel) || 0) + 1);
  const topModel = [...modelCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topModel) {
    lines.push(`Most active: **${topModel[0]}** with ${topModel[1]} listings.`);
  }

  // News signal
  if (news.length > 0) {
    const nvidiaNews = news.filter(n => n.headline.toLowerCase().includes('nvidia') || n.headline.toLowerCase().includes('gpu'));
    if (nvidiaNews.length > 0) {
      lines.push(`**${news.length}** industry headlines tracked today.`);
    }
  }

  return lines.join(' ');
}
