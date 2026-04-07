import { getSupabase } from './supabase';
import type { BulkListing } from './types';

export interface PriceDrop {
  gpuModel: string;
  title: string;
  currentPrice: number;
  previousPrice: number;
  dropPercent: number;
  dropAmount: number;
  link: string;
  seller: string;
  condition: string;
  quantity: number;
}

/**
 * Compare current listings against historical prices in Supabase
 * to detect real price drops per GPU model.
 */
export async function detectPriceDrops(listings: BulkListing[]): Promise<PriceDrop[]> {
  const sb = getSupabase();
  const drops: PriceDrop[] = [];

  // Get historical average prices per GPU model from the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = await sb
    .from('listings')
    .select('gpu_model, price_per_unit')
    .gt('found_at', weekAgo);

  if (!history || history.length === 0) return [];

  // Calculate average price per model from history
  const modelAvg: Record<string, { total: number; count: number }> = {};
  for (const row of history) {
    const model = row.gpu_model || 'Other GPU';
    if (!modelAvg[model]) modelAvg[model] = { total: 0, count: 0 };
    modelAvg[model].total += Number(row.price_per_unit);
    modelAvg[model].count++;
  }

  const avgPrices: Record<string, number> = {};
  for (const [model, data] of Object.entries(modelAvg)) {
    avgPrices[model] = Math.round(data.total / data.count);
  }

  // Find listings priced below the 7-day average
  for (const listing of listings) {
    const avg = avgPrices[listing.gpuModel];
    if (!avg || avg === 0) continue;

    const dropPercent = ((avg - listing.pricePerUnit) / avg) * 100;

    // Only flag drops of 10% or more
    if (dropPercent >= 10) {
      drops.push({
        gpuModel: listing.gpuModel,
        title: listing.title,
        currentPrice: listing.pricePerUnit,
        previousPrice: avg,
        dropPercent: Math.round(dropPercent),
        dropAmount: avg - listing.pricePerUnit,
        link: listing.link,
        seller: listing.seller,
        condition: listing.condition,
        quantity: listing.quantity,
      });
    }
  }

  // Sort by biggest drop percentage
  drops.sort((a, b) => b.dropPercent - a.dropPercent);

  return drops.slice(0, 8);
}

/**
 * Get current market snapshot — avg price per model from today's scan.
 */
export function getMarketSnapshot(listings: BulkListing[]): Record<string, {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  count: number;
}> {
  const models: Record<string, { prices: number[]; count: number }> = {};

  for (const l of listings) {
    if (!models[l.gpuModel]) models[l.gpuModel] = { prices: [], count: 0 };
    models[l.gpuModel].prices.push(l.pricePerUnit);
    models[l.gpuModel].count++;
  }

  const snapshot: Record<string, { avgPrice: number; minPrice: number; maxPrice: number; count: number }> = {};
  for (const [model, data] of Object.entries(models)) {
    const sorted = data.prices.sort((a, b) => a - b);
    snapshot[model] = {
      avgPrice: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      minPrice: sorted[0],
      maxPrice: sorted[sorted.length - 1],
      count: data.count,
    };
  }

  return snapshot;
}
