/**
 * Multi-source GPU bulk lot & company finder.
 * Finds companies selling GPUs on auction/liquidation platforms.
 * All fetch-based — works on Vercel serverless.
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
  if (t.includes('auction')) score += 15;
  if (l.quantity > 1) score += l.quantity * 5;
  if (l.quantity >= 10) score += 50;
  if (l.gpuModel.includes('H100')) score += 40;
  if (l.gpuModel.includes('A100')) score += 35;
  if (l.gpuModel.includes('4090') || l.gpuModel.includes('5090')) score += 25;
  if (l.pricePerUnit > 0 && l.pricePerUnit < 500) score += 30;
  else if (l.pricePerUnit > 0 && l.pricePerUnit < 1000) score += 15;
  return score;
}

// ─── BidSpotter (Industrial Auctions) ────────────────────

async function scrapeBidSpotter(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  const queries = ['NVIDIA GPU', 'RTX 4090', 'GPU lot', 'server GPU'];

  for (const query of queries) {
    try {
      const url = `https://www.bidspotter.com/en-us/search?query=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Parse auction lots
      const lotRegex = /<a[^>]*href="(\/en-us\/auction-catalogues\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = lotRegex.exec(html)) !== null && listings.length < 20) {
        const link = `https://www.bidspotter.com${match[1]}`;
        const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const gpuModel = detectGPUModel(text);
        if (!gpuModel || text.length < 10) continue;

        const priceMatch = text.match(/\$([0-9,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
        const quantity = detectQuantity(text);

        const listing: GpuListing = {
          title: text.slice(0, 120),
          price, pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
          quantity, gpuModel, condition: 'Auction', seller: 'BidSpotter',
          link, source: 'bidspotter', foundAt: new Date().toISOString(), score: 0,
        };
        listing.score = scoreListing(listing);
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[BidSpotter] Error:`, (err as Error).message);
    }
  }

  return listings;
}

// ─── Liquidation.com ─────────────────────────────────────

async function scrapeLiquidation(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];

  try {
    const url = 'https://www.liquidation.com/aucpages/searchauctions.cfm?keyword=GPU+NVIDIA&category=0';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Parse auction cards
    const cardRegex = /<a[^>]*href="(\/aucpages\/[^"]*)"[^>]*>[\s\S]*?<\/a>/g;
    let match;
    while ((match = cardRegex.exec(html)) !== null && listings.length < 15) {
      const link = `https://www.liquidation.com${match[1]}`;
      const text = match[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const gpuModel = detectGPUModel(text);
      if (!gpuModel) continue;

      const priceMatch = text.match(/\$([0-9,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
      const quantity = detectQuantity(text);

      const listing: GpuListing = {
        title: text.slice(0, 120),
        price, pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
        quantity, gpuModel, condition: 'Liquidation', seller: 'Liquidation.com',
        link, source: 'liquidation', foundAt: new Date().toISOString(), score: 0,
      };
      listing.score = scoreListing(listing) + 20;
      listings.push(listing);
    }
  } catch (err) {
    console.error(`[Liquidation.com] Error:`, (err as Error).message);
  }

  return listings;
}

// ─── HiBid (Auction Platform) ────────────────────────────

async function scrapeHiBid(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];

  try {
    const url = 'https://www.hibid.com/search?q=NVIDIA+GPU+lot&sort=EndingSoon';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const itemRegex = /<a[^>]*href="(\/lots\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = itemRegex.exec(html)) !== null && listings.length < 15) {
      const link = `https://www.hibid.com${match[1]}`;
      const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const gpuModel = detectGPUModel(text);
      if (!gpuModel || text.length < 10) continue;

      const priceMatch = text.match(/\$([0-9,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
      const quantity = detectQuantity(text);

      const listing: GpuListing = {
        title: text.slice(0, 120),
        price, pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
        quantity, gpuModel, condition: 'Auction', seller: 'HiBid',
        link, source: 'hibid', foundAt: new Date().toISOString(), score: 0,
      };
      listing.score = scoreListing(listing);
      listings.push(listing);
    }
  } catch (err) {
    console.error(`[HiBid] Error:`, (err as Error).message);
  }

  return listings;
}

// ─── GovDeals (Government Surplus) ───────────────────────

async function scrapeGovDeals(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];

  try {
    const url = 'https://www.govdeals.com/index.cfm?fa=Main.AdvSearchResultsNew&searchPg=Category&additession=&category=00&description=GPU+NVIDIA&min_price=0&max_price=0&state=&auction_id=&sort=ad&PageNum=1&ESSION_ID=';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const rowRegex = /<a[^>]*href="(index\.cfm\?fa=Main\.Item[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null && listings.length < 15) {
      const link = `https://www.govdeals.com/${match[1]}`;
      const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const gpuModel = detectGPUModel(text);
      if (!gpuModel) continue;

      const priceMatch = text.match(/\$([0-9,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
      const quantity = detectQuantity(text);

      const listing: GpuListing = {
        title: text.slice(0, 120),
        price, pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
        quantity, gpuModel, condition: 'Government Surplus', seller: 'GovDeals',
        link, source: 'govdeals', foundAt: new Date().toISOString(), score: 0,
      };
      listing.score = scoreListing(listing) + 30;
      listings.push(listing);
    }
  } catch (err) {
    console.error(`[GovDeals] Error:`, (err as Error).message);
  }

  return listings;
}

// ─── Reddit (r/hardwareswap sellers) ─────────────────────

async function scrapeReddit(): Promise<GpuListing[]> {
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
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
        const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
        const link = linkMatch ? linkMatch[1] : '';

        if (!title || title.length < 10) continue;
        const gpuModel = detectGPUModel(title);
        if (!gpuModel) continue;

        const priceMatch = title.match(/\$([0-9,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
        const quantity = detectQuantity(title);

        const listing: GpuListing = {
          title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 120),
          price, pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
          quantity, gpuModel, condition: 'Used', seller: 'Reddit',
          link, source: 'reddit', foundAt: new Date().toISOString(), score: 0,
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

// ─── Google News for GPU bulk sales ──────────────────────

async function scrapeGpuSaleNews(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  const queries = [
    'GPU bulk lot sale',
    'NVIDIA RTX 4090 bulk wholesale',
    'datacenter GPU liquidation sale',
    'GPU auction lot NVIDIA',
  ];

  const now = Date.now();
  const picked = queries
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 53) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 2);

  for (const query of picked) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:7d')}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && listings.length < 10) {
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/);
        const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);

        const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
        const link = linkMatch ? linkMatch[1].trim() : '';
        const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : 'News';

        if (!title || title.length < 15) continue;
        const gpuModel = detectGPUModel(title);
        if (!gpuModel) continue;

        const listing: GpuListing = {
          title: title.replace(/&amp;/g, '&').slice(0, 120),
          price: 0, pricePerUnit: 0, quantity: 1,
          gpuModel, condition: 'News', seller: source,
          link, source: 'news', foundAt: new Date().toISOString(), score: 0,
        };
        listing.score = scoreListing(listing) + 10;
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[GPU News] Error:`, (err as Error).message);
    }
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
  // Run ALL sources in parallel
  const [bidspotter, liquidation, hibid, govdeals, reddit, gpuNews] = await Promise.all([
    scrapeBidSpotter(),
    scrapeLiquidation(),
    scrapeHiBid(),
    scrapeGovDeals(),
    scrapeReddit(),
    scrapeGpuSaleNews(),
  ]);

  const sources: Record<string, number> = {
    bidspotter: bidspotter.length,
    liquidation: liquidation.length,
    hibid: hibid.length,
    govdeals: govdeals.length,
    reddit: reddit.length,
    'gpu-news': gpuNews.length,
  };

  const allListings = [...bidspotter, ...liquidation, ...hibid, ...govdeals, ...reddit, ...gpuNews];
  const totalScanned = allListings.length;

  console.log(`[GPU] Sources: BidSpotter=${bidspotter.length}, Liquidation=${liquidation.length}, HiBid=${hibid.length}, GovDeals=${govdeals.length}, Reddit=${reddit.length}, News=${gpuNews.length}`);

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
