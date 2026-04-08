/**
 * Scrapes GPU bulk lots from eBay using fetch + cheerio.
 * No Puppeteer needed — works on Vercel serverless.
 */

import * as cheerio from 'cheerio';
import type { GpuListing } from './types';

// ─── Query Pools ─────────────────────────────────────────

const DC_QUERIES = [
  'datacenter GPU decommission',
  'datacenter GPU liquidation lot',
  'server GPU pull lot',
  'data center decommission nvidia',
  'enterprise GPU surplus lot',
  'GPU server pull wholesale',
];

const BULK_QUERIES = [
  'RTX 4090 lot bulk',
  'RTX 5090 lot',
  'RTX 3090 lot bulk',
  'NVIDIA A100 lot',
  'NVIDIA H100',
  'RTX A6000 lot',
  'GPU wholesale lot',
  'graphics card lot bulk',
];

const LIQUIDATION_QUERIES = [
  'GPU liquidation sale lot',
  'GPU auction lot nvidia',
  'GPU ITAD surplus',
  'mining farm GPU sale lot',
  'GPU bankruptcy liquidation',
  'server GPU decommission lot',
];

function pickQueries(count: number = 6): string[] {
  const all = [...DC_QUERIES, ...BULK_QUERIES, ...LIQUIDATION_QUERIES];
  const now = Date.now();
  const shuffled = all
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 137.5) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q);
  // Always include 2 DC queries
  const dcPicks = DC_QUERIES
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 71) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 2);
  const rest = shuffled.filter(q => !dcPicks.includes(q)).slice(0, count - 2);
  return [...dcPicks, ...rest];
}

// ─── GPU Detection ───────────────────────────────────────

const GPU_MODELS = [
  'H200', 'H100', 'B200', 'L40S', 'L40', 'A100', 'A6000', 'A5000', 'A4000',
  'RTX 5090', 'RTX 5080', 'RTX 4090', 'RTX 4080', 'RTX 4070', 'RTX 4060',
  'RTX 3090 TI', 'RTX 3090', 'RTX 3080 TI', 'RTX 3080', 'RTX 3070', 'RTX 3060',
  'TESLA V100', 'TESLA P100', 'TESLA T4',
  'QUADRO RTX', 'QUADRO',
  'RX 7900', 'RX 6900', 'RX 6800',
];

function detectGPUModel(title: string): string {
  const upper = title.toUpperCase();
  return GPU_MODELS.find(m => upper.includes(m)) || 'Other GPU';
}

function detectQuantity(title: string): number {
  const patterns = [
    /lot\s+of\s+(\d+)/i, /(\d+)\s*x\s+(?:nvidia|rtx|gpu|geforce)/i,
    /x\s*(\d+)\s+(?:nvidia|rtx|gpu|geforce)/i, /qty\s*:?\s*(\d+)/i,
    /(\d+)\s*units/i, /(\d+)\s*pcs/i, /(\d+)\s*pieces/i,
    /(\d+)\s*pack/i, /(\d+)\s*cards/i,
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m) {
      const n = parseInt(m[1]);
      if (n > 1 && n <= 500) return n;
    }
  }
  return 1;
}

const EXCLUDE_KEYWORDS = [
  'broken', 'for parts', 'untested', 'as-is', 'not working', 'damaged',
  'empty box', 'box only', 'mining rig frame', 'case only', 'fan only',
  'heatsink only', 'bracket only', 'backplate only',
];

function scoreListing(l: GpuListing): number {
  let score = 0;
  const t = l.title.toLowerCase();
  if (t.includes('datacenter') || t.includes('data center')) score += 50;
  if (t.includes('server pull')) score += 40;
  if (t.includes('decommission')) score += 60;
  if (t.includes('liquidation')) score += 40;
  if (t.includes('enterprise')) score += 30;
  if (t.includes('surplus')) score += 25;
  if (t.includes('lot') || t.includes('bulk')) score += 20;
  if (l.quantity > 1) score += l.quantity * 5;
  if (l.quantity >= 10) score += 50;
  if (l.gpuModel.includes('H100')) score += 40;
  if (l.gpuModel.includes('A100')) score += 35;
  if (l.gpuModel.includes('4090') || l.gpuModel.includes('5090')) score += 25;
  if (l.gpuModel.includes('A6000')) score += 20;
  if (l.pricePerUnit < 500) score += 30;
  else if (l.pricePerUnit < 1000) score += 15;
  return score;
}

// ─── eBay Scraper (fetch + cheerio) ──────────────────────

async function scrapeEbayQuery(query: string): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=0&LH_BIN=1&_sop=10&_ipg=60`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      console.error(`[eBay] HTTP ${res.status} for "${query}"`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    $('li.s-item').each((_, el) => {
      const $el = $(el);
      const title = $el.find('.s-item__title span').first().text().trim()
        || $el.find('.s-item__title').first().text().trim();
      const priceText = $el.find('.s-item__price').first().text().trim();
      const link = $el.find('a.s-item__link').attr('href') || '';
      const condition = $el.find('.SECONDARY_INFO').first().text().trim() || 'Used';
      const seller = $el.find('.s-item__seller-info-text').first().text().trim() || 'Unknown';

      if (!title || title === 'Shop on eBay' || !link) return;

      // Parse price
      const priceMatch = priceText.match(/\$([0-9,]+\.?\d*)/);
      if (!priceMatch) return;
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (price < 10 || price > 50000) return;

      // Exclude junk
      const lower = title.toLowerCase();
      if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return;

      const quantity = detectQuantity(title);
      const gpuModel = detectGPUModel(title);

      const listing: GpuListing = {
        title,
        price,
        pricePerUnit: quantity > 1 ? Math.round(price / quantity) : price,
        quantity,
        gpuModel,
        condition,
        seller,
        link: link.split('?')[0], // clean URL
        source: 'ebay',
        foundAt: new Date().toISOString(),
        score: 0,
      };
      listing.score = scoreListing(listing);
      listings.push(listing);
    });
  } catch (err) {
    console.error(`[eBay] Error scraping "${query}":`, (err as Error).message);
  }

  return listings;
}

// ─── Main Scanner ────────────────────────────────────────

export async function scanForGpuDeals(): Promise<{
  listings: GpuListing[];
  totalScanned: number;
  queriesUsed: string[];
}> {
  const queries = pickQueries(6);
  const allListings: GpuListing[] = [];
  let totalScanned = 0;

  for (const query of queries) {
    const results = await scrapeEbayQuery(query);
    totalScanned += results.length;
    allListings.push(...results);
    console.log(`[GPU] "${query}" → ${results.length} listings`);
  }

  // Dedup by link
  const seen = new Set<string>();
  const deduped = allListings.filter(l => {
    if (seen.has(l.link)) return false;
    seen.add(l.link);
    return true;
  });

  // Sort by score
  deduped.sort((a, b) => b.score - a.score);

  return { listings: deduped, totalScanned, queriesUsed: queries };
}
