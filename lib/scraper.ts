import type { BulkListing } from './types';

export interface DealScanConfig {
  queries: string[];
  maxPrice: number;
  minQuantity: number;
  excludeKeywords: string[];
  maxPages: number;
}

// ─── Query Pools (rotated each run) ──────────────────────

const DC_DECOMMISSION_QUERIES = [
  'datacenter GPU decommission',
  'datacenter GPU liquidation',
  'datacenter GPU lot',
  'server GPU pull lot',
  'data center decommission nvidia',
  'datacenter equipment GPU sale',
  'enterprise GPU surplus',
  'colocation GPU decommission',
  'rack server GPU lot',
  'GPU server pull wholesale',
];

const BULK_LOT_QUERIES = [
  'RTX 4090 lot',
  'RTX 4090 bulk',
  'RTX 3090 lot',
  'RTX 3090 bulk',
  'RTX A6000 lot',
  'NVIDIA A100 lot',
  'NVIDIA H100',
  'Tesla GPU lot',
  'GPU wholesale lot',
  'graphics card lot bulk',
];

const LIQUIDATION_QUERIES = [
  'GPU liquidation sale',
  'GPU auction lot',
  'GPU estate sale',
  'NVIDIA GPU refurbished lot',
  'GPU ITAD',
  'GPU surplus equipment',
  'mining farm GPU sale',
  'GPU bankruptcy sale',
  'used enterprise GPU lot',
  'server GPU decommission lot',
];

function pickQueries(count: number = 8): string[] {
  const all = [...DC_DECOMMISSION_QUERIES, ...BULK_LOT_QUERIES, ...LIQUIDATION_QUERIES];
  const now = Date.now();
  const shuffled = all
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 137.5) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q);
  const dcPicks = DC_DECOMMISSION_QUERIES
    .sort(() => Math.sin(now / 1000) - 0.5)
    .slice(0, 3);
  const rest = shuffled.filter(q => !dcPicks.includes(q)).slice(0, count - 3);
  return [...dcPicks, ...rest];
}

const DEFAULT_CONFIG: DealScanConfig = {
  queries: [],
  maxPrice: 50000,
  minQuantity: 1,
  excludeKeywords: [
    'broken', 'for parts', 'untested', 'as-is', 'not working', 'damaged',
    'empty box', 'box only', 'mining rig frame', 'case only', 'fan only',
    'heatsink only', 'bracket only', 'backplate only',
  ],
  maxPages: 2,
};

// ─── Helpers ──────────────────────────────────────────────

function containsExcluded(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

function detectGPUModel(title: string): string {
  const upper = title.toUpperCase();
  const models = [
    'H200', 'H100', 'B200', 'L40S', 'L40', 'A100', 'A6000', 'A5000', 'A4000',
    'RTX 5090', 'RTX 5080', 'RTX 4090', 'RTX 4080', 'RTX 4070', 'RTX 4060',
    'RTX 3090 TI', 'RTX 3090', 'RTX 3080 TI', 'RTX 3080', 'RTX 3070', 'RTX 3060',
    'TESLA V100', 'TESLA P100', 'TESLA T4',
    'QUADRO RTX', 'QUADRO',
    'RX 7900', 'RX 6900', 'RX 6800',
  ];
  return models.find(m => upper.includes(m)) || 'Other GPU';
}

function detectQuantity(title: string): number {
  const patterns = [
    /lot\s+of\s+(\d+)/i,
    /(\d+)\s*x\s+(?:nvidia|rtx|gpu|geforce)/i,
    /x\s*(\d+)\s+(?:nvidia|rtx|gpu|geforce)/i,
    /qty\s*:?\s*(\d+)/i,
    /(\d+)\s*units/i,
    /(\d+)\s*pcs/i,
    /(\d+)\s*pieces/i,
    /(\d+)\s*pack/i,
    /(\d+)\s*cards/i,
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

function scoreListing(listing: BulkListing): number {
  let score = 0;
  const t = listing.title.toLowerCase();
  if (t.includes('datacenter') || t.includes('data center')) score += 50;
  if (t.includes('server pull') || t.includes('server-pull')) score += 40;
  if (t.includes('decommission')) score += 60;
  if (t.includes('liquidation')) score += 40;
  if (t.includes('enterprise')) score += 30;
  if (t.includes('surplus')) score += 25;
  if (t.includes('lot') || t.includes('bulk')) score += 20;
  if (listing.quantity > 1) score += listing.quantity * 5;
  if (listing.quantity >= 10) score += 50;
  if (listing.gpuModel.includes('H100')) score += 40;
  if (listing.gpuModel.includes('A100')) score += 35;
  if (listing.gpuModel.includes('4090')) score += 25;
  if (listing.gpuModel.includes('A6000')) score += 20;
  if (listing.pricePerUnit < 500) score += 30;
  else if (listing.pricePerUnit < 1000) score += 15;
  return score;
}

import { getBrowser, closeBrowser } from './browser';

// ─── Scrape a single search page ─────────────────────────

interface RawListing {
  title: string;
  price: number;
  condition: string;
  seller: string;
  link: string;
}

async function scrapeEbayPage(url: string): Promise<RawListing[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Block images/fonts/media for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate — challenge page may cause a redirect
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    } catch {
      // Challenge redirect — expected
    }

    // Wait for challenge to resolve
    await new Promise(r => setTimeout(r, 5000));

    // Extract listings from the rendered DOM
    const items: RawListing[] = await page.evaluate(() => {
      const results: { title: string; price: number; condition: string; seller: string; link: string }[] = [];
      const cards = document.querySelectorAll('li[data-listingid]');

      for (const card of cards) {
        const text = (card as HTMLElement).innerText || '';
        if (text.includes('Shop on')) continue;

        // Find the item link
        const linkEl = card.querySelector('a[href*="/itm/"]');
        if (!linkEl) continue;
        const link = (linkEl as HTMLAnchorElement).href;

        // Parse text: title | condition | price | shipping | seller
        const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

        // Title: first substantial line (skip "NEW LISTING", "SPONSORED" etc)
        let title = '';
        for (const line of lines) {
          const clean = line.replace(/^NEW LISTING/i, '').replace(/^SPONSORED/i, '').trim();
          if (clean.length > 15 && !clean.startsWith('Opens in')) {
            title = clean;
            break;
          }
        }
        if (!title) continue;

        // Price: find line with dollar sign
        let price = 0;
        for (const line of lines) {
          const m = line.match(/\$([0-9,]+\.?\d*)/);
          if (m) {
            price = parseFloat(m[1].replace(/,/g, ''));
            break;
          }
        }
        if (!price) continue;

        // Condition
        let condition = 'Used';
        for (const line of lines) {
          const cl = line.toLowerCase();
          if (cl.includes('brand new')) { condition = 'New'; break; }
          if (cl.includes('pre-owned')) { condition = 'Pre-Owned'; break; }
          if (cl.includes('refurbished')) { condition = 'Refurbished'; break; }
          if (cl.includes('parts only')) { condition = 'Parts Only'; break; }
          if (cl.includes('open box')) { condition = 'Open Box'; break; }
        }

        // Seller
        let seller = 'Unknown';
        for (const line of lines) {
          const sm = line.match(/^(\S+)\s+[\d.]+%\s+positive/);
          if (sm) { seller = sm[1]; break; }
        }

        results.push({ title, price, condition, seller, link });
      }
      return results;
    });

    return items;
  } finally {
    await page.close();
  }
}

// ─── Main Scanner ─────────────────────────────────────────

export async function scanForDeals(customConfig?: Partial<DealScanConfig>): Promise<{
  listings: BulkListing[];
  totalScanned: number;
  queriesUsed: string[];
}> {
  const queries = customConfig?.queries?.length ? customConfig.queries : pickQueries(8);
  const config = { ...DEFAULT_CONFIG, ...customConfig, queries };

  const allListings: BulkListing[] = [];
  let totalScanned = 0;

  try {
    for (const query of config.queries) {
      for (let page = 1; page <= config.maxPages; page++) {
        const offset = (page - 1) * 60;
        const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=0&LH_BIN=1&_sop=10&_ipg=60&_pgn=${page}&_skc=${offset > 0 ? offset : 0}`;

        try {
          console.log(`[Scraper] "${query}" page ${page}...`);
          const raw = await scrapeEbayPage(url);
          totalScanned += raw.length;

          for (const item of raw) {
            if (item.price > config.maxPrice || item.price < 10) continue;
            if (containsExcluded(item.title, config.excludeKeywords)) continue;

            const quantity = detectQuantity(item.title);
            const gpuModel = detectGPUModel(item.title);

            allListings.push({
              id: Math.random().toString(36).substring(2, 10),
              title: item.title,
              price: item.price,
              pricePerUnit: quantity > 1 ? Math.round(item.price / quantity) : item.price,
              quantity,
              gpuModel,
              source: 'web',
              seller: item.seller,
              condition: item.condition,
              link: item.link,
              foundAt: new Date().toISOString(),
            });
          }

          console.log(`[Scraper] Got ${raw.length} items from "${query}" p${page}`);
        } catch (err) {
          console.error(`[Scraper] Error on "${query}" p${page}:`, (err as Error).message);
        }
      }
    }
  } finally {
    await closeBrowser();
  }

  // Deduplicate by link
  const seen = new Set<string>();
  const deduped = allListings.filter(l => {
    if (seen.has(l.link)) return false;
    seen.add(l.link);
    return true;
  });

  // Score and sort
  const scored = deduped.map(l => ({ ...l, _score: scoreListing(l) }));
  scored.sort((a, b) => b._score - a._score);
  const final = scored.map(({ _score, ...rest }) => rest);

  return { listings: final, totalScanned, queriesUsed: queries };
}

export { DEFAULT_CONFIG };
