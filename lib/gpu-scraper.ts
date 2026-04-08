/**
 * Multi-source GPU deal scraper.
 * Sources: eBay API, eBay RSS, Reddit RSS, GSA Auctions, Craigslist.
 * All fetch-based — no Puppeteer, works on Vercel.
 */

import type { GpuListing } from './types';

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
  return GPU_MODELS.find(m => upper.includes(m)) || '';
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

function isExcluded(title: string): boolean {
  const lower = title.toLowerCase();
  return EXCLUDE_KEYWORDS.some(kw => lower.includes(kw));
}

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
  if (l.pricePerUnit > 0 && l.pricePerUnit < 500) score += 30;
  else if (l.pricePerUnit > 0 && l.pricePerUnit < 1000) score += 15;
  return score;
}

// ─── eBay API ────────────────────────────────────────────

const EBAY_QUERIES = [
  'GPU lot bulk NVIDIA',
  'RTX 4090 lot',
  'RTX 5090',
  'NVIDIA A100',
  'NVIDIA H100',
  'datacenter GPU decommission',
  'server GPU liquidation lot',
  'RTX 3090 lot bulk',
  'GPU wholesale lot',
  'enterprise GPU surplus',
];

async function getEbayToken(): Promise<string | null> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!res.ok) {
      console.error(`[eBay API] Token error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error('[eBay API] Token error:', (err as Error).message);
    return null;
  }
}

async function scrapeEbayAPI(): Promise<GpuListing[]> {
  const token = await getEbayToken();
  if (!token) {
    console.log('[eBay API] No credentials — skipping');
    return [];
  }

  const listings: GpuListing[] = [];

  // Pick 4 queries per run
  const now = Date.now();
  const queries = EBAY_QUERIES
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 137.5) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 4);

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '50',
        filter: 'buyingOptions:{FIXED_PRICE},price:[10..50000],priceCurrency:USD',
        sort: 'newlyListed',
      });

      const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
      });

      if (!res.ok) {
        console.error(`[eBay API] Search error ${res.status} for "${query}"`);
        continue;
      }

      const data = await res.json();
      const items = data.itemSummaries || [];

      for (const item of items) {
        const title = item.title || '';
        const price = parseFloat(item.price?.value || '0');
        const link = item.itemWebUrl || '';
        const condition = item.condition || 'Used';
        const seller = item.seller?.username || 'Unknown';

        if (!title || price < 10 || price > 50000 || isExcluded(title)) continue;

        const gpuModel = detectGPUModel(title);
        if (!gpuModel) continue;

        const quantity = detectQuantity(title);

        const listing: GpuListing = {
          title,
          price,
          pricePerUnit: quantity > 1 ? Math.round(price / quantity) : price,
          quantity,
          gpuModel,
          condition,
          seller,
          link,
          source: 'ebay',
          foundAt: new Date().toISOString(),
          score: 0,
        };
        listing.score = scoreListing(listing);
        listings.push(listing);
      }

      console.log(`[eBay API] "${query}" → ${items.length} items, ${listings.length} GPU listings`);
    } catch (err) {
      console.error(`[eBay API] Error for "${query}":`, (err as Error).message);
    }
  }

  return listings;
}

// ─── eBay RSS (backup) ───────────────────────────────────

async function scrapeEbayRSS(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  const queries = ['GPU+lot+bulk+NVIDIA', 'RTX+4090+lot', 'datacenter+GPU+liquidation', 'NVIDIA+A100+lot'];

  for (const query of queries) {
    try {
      const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&_rss=1&_sop=10&LH_BIN=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });

      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = extractTag(block, 'title');
        const link = extractTag(block, 'link');

        if (!title || title.length < 10 || isExcluded(title)) continue;

        const gpuModel = detectGPUModel(title);
        if (!gpuModel) continue;

        // Try to extract price from description
        const desc = extractTag(block, 'description');
        const priceMatch = desc.match(/\$([0-9,]+\.?\d*)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
        const quantity = detectQuantity(title);

        const listing: GpuListing = {
          title: decodeHtmlEntities(title),
          price,
          pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
          quantity,
          gpuModel,
          condition: 'Used',
          seller: 'eBay',
          link: link || '',
          source: 'ebay-rss',
          foundAt: new Date().toISOString(),
          score: 0,
        };
        listing.score = scoreListing(listing);
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[eBay RSS] Error:`, (err as Error).message);
    }
  }

  return listings;
}

// ─── Reddit RSS ──────────────────────────────────────────

async function scrapeRedditRSS(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  const feeds = [
    'https://www.reddit.com/r/hardwareswap/search.rss?q=GPU+lot+OR+RTX+4090+OR+RTX+5090+OR+A100+OR+H100&sort=new&t=week',
    'https://www.reddit.com/r/buildapcsales/search.rss?q=GPU&sort=new&t=day',
  ];

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;
      while ((match = entryRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = extractTag(block, 'title');
        const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
        const link = linkMatch ? linkMatch[1] : '';

        if (!title || title.length < 10) continue;

        const gpuModel = detectGPUModel(title);
        if (!gpuModel) continue;

        // Extract price from title
        const priceMatch = title.match(/\$([0-9,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
        const quantity = detectQuantity(title);

        const listing: GpuListing = {
          title: decodeHtmlEntities(title).slice(0, 120),
          price,
          pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
          quantity,
          gpuModel,
          condition: 'Used',
          seller: 'Reddit',
          link,
          source: 'reddit',
          foundAt: new Date().toISOString(),
          score: 0,
        };
        listing.score = scoreListing(listing);
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[Reddit] Error:`, (err as Error).message);
    }
  }

  return listings;
}

// ─── GSA Auctions (Government Surplus) ───────────────────

async function scrapeGSA(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];

  try {
    const res = await fetch('https://gsaauctions.gov/gsaauctions/aucssrch?searchType=1&keyword=GPU+NVIDIA&x=0&y=0', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
    });
    if (!res.ok) return [];

    const html = await res.text();

    // Parse auction listings from HTML
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
    for (const row of rows) {
      const titleMatch = row.match(/>([^<]*(?:GPU|NVIDIA|RTX|Tesla|Quadro)[^<]*)</i);
      const linkMatch = row.match(/href="([^"]*aucDetail[^"]*)"/);
      if (!titleMatch) continue;

      const title = titleMatch[1].trim();
      const gpuModel = detectGPUModel(title);
      if (!gpuModel) continue;

      const link = linkMatch ? `https://gsaauctions.gov${linkMatch[1]}` : '';
      const priceMatch = row.match(/\$([0-9,]+\.?\d*)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
      const quantity = detectQuantity(title);

      const listing: GpuListing = {
        title: title.slice(0, 120),
        price,
        pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
        quantity,
        gpuModel,
        condition: 'Government Surplus',
        seller: 'GSA Auctions',
        link,
        source: 'gsa',
        foundAt: new Date().toISOString(),
        score: 0,
      };
      listing.score = scoreListing(listing) + 30; // Bonus for government source
      listings.push(listing);
    }
  } catch (err) {
    console.error(`[GSA] Error:`, (err as Error).message);
  }

  return listings;
}

// ─── Main Scanner ────────────────────────────────────────

export async function scanForGpuDeals(): Promise<{
  listings: GpuListing[];
  totalScanned: number;
  queriesUsed: string[];
  sources: Record<string, number>;
}> {
  // Run all sources in parallel
  const [ebayApi, ebayRss, reddit, gsa] = await Promise.all([
    scrapeEbayAPI(),
    scrapeEbayRSS(),
    scrapeRedditRSS(),
    scrapeGSA(),
  ]);

  const sources: Record<string, number> = {
    'ebay-api': ebayApi.length,
    'ebay-rss': ebayRss.length,
    'reddit': reddit.length,
    'gsa': gsa.length,
  };

  const allListings = [...ebayApi, ...ebayRss, ...reddit, ...gsa];
  const totalScanned = allListings.length;

  console.log(`[GPU] Sources: eBay API=${ebayApi.length}, eBay RSS=${ebayRss.length}, Reddit=${reddit.length}, GSA=${gsa.length}`);

  // Dedup by link
  const seen = new Set<string>();
  const deduped = allListings.filter(l => {
    if (!l.link || seen.has(l.link)) return false;
    seen.add(l.link);
    return true;
  });

  // Sort by score
  deduped.sort((a, b) => b.score - a.score);

  const queriesUsed = Object.entries(sources)
    .filter(([, count]) => count > 0)
    .map(([source, count]) => `${source}: ${count}`);

  return { listings: deduped, totalScanned, queriesUsed, sources };
}

// ─── Helpers ─────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}
