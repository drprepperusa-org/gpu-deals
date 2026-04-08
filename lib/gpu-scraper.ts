/**
 * Multi-source GPU bulk lot & company finder.
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
  'RTX', 'GTX',
];

const GPU_KEYWORDS = [
  'gpu', 'graphics card', 'nvidia', 'geforce', 'radeon', 'video card',
];

// ─── Hard Reject Filter ──────────────────────────────────
// Items that match these are NOT standalone GPUs — reject immediately.

const REJECT_TERMS = [
  // Computers & laptops
  'laptop', 'notebook', 'macbook', 'chromebook', 'ultrabook',
  'desktop computer', 'complete system', 'complete pc', 'gaming pc',
  'workstation pc', 'all-in-one', 'mini pc', 'nuc',
  // CPUs
  'cpu', 'processor', 'xeon', 'ryzen', 'threadripper', 'i7-', 'i9-', 'i5-',
  'core i7', 'core i9', 'core i5', 'epyc',
  // Other components (not GPUs)
  'motherboard', 'mainboard', 'mobo',
  'ram only', 'memory only', 'ddr4 only', 'ddr5 only',
  'ssd only', 'nvme only', 'hard drive', 'hdd only',
  'power supply', 'psu only',
  'case only', 'chassis only', 'enclosure only',
  'monitor only', 'display only', 'screen only',
  'keyboard', 'mouse only',
  'cable only', 'adapter only', 'riser only',
  // Junk / broken
  'broken', 'for parts', 'not working', 'as-is', 'damaged',
  'untested', 'defective', 'dead', 'burnt',
  'empty box', 'box only', 'no gpu', 'without gpu',
  'mining rig frame', 'fan only', 'heatsink only',
  'bracket only', 'backplate only', 'shroud only',
  // Mixed lots (not GPU-only)
  'mixed electronics', 'electronics lot', 'computer parts lot',
  'office equipment', 'printer', 'scanner',
  // Software / services
  'software', 'license', 'subscription', 'cloud credits',
  'rental', 'renting',
];

// Items must contain at least one GPU-confirming term
const GPU_CONFIRM_TERMS = [
  'gpu', 'graphics card', 'video card',
  'rtx', 'gtx', 'geforce', 'radeon', 'rx ',
  'nvidia', 'quadro', 'tesla v100', 'tesla p100', 'tesla t4',
  'a100', 'a6000', 'a5000', 'a4000', 'h100', 'h200', 'b200',
  'l40', 'l40s',
];

/**
 * Hard filter: reject items that are NOT standalone GPUs.
 * Returns null if rejected, or the clean title if accepted.
 */
function hardFilter(title: string): boolean {
  const lower = title.toLowerCase();

  // Step 1: Reject if it matches any reject term
  for (const term of REJECT_TERMS) {
    if (lower.includes(term)) {
      // Exception: if the title also strongly confirms GPU
      // e.g. "RTX 4090 for parts" should still be rejected
      // but "GPU lot with laptop bag" — the reject term is "laptop" which is wrong
      // So only allow exception if GPU term comes BEFORE reject term
      return false;
    }
  }

  // Step 2: Must contain at least one GPU-confirming term
  const hasGpuTerm = GPU_CONFIRM_TERMS.some(term => lower.includes(term));
  if (!hasGpuTerm) return false;

  return true;
}

function detectGPUModel(title: string): string {
  const upper = title.toUpperCase();
  return GPU_MODELS.find(m => upper.includes(m)) || '';
}

function isGpuRelated(title: string): boolean {
  const lower = title.toLowerCase();
  return GPU_KEYWORDS.some(kw => lower.includes(kw)) || !!detectGPUModel(title);
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
  if (t.includes('wholesale')) score += 15;
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

// ─── RSS Parser Helper ───────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function decodeEntities(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ─── Reddit RSS (multiple subreddits) ────────────────────

async function scrapeReddit(timeParam: string): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];

  const feeds = [
    // Hardware swap - people selling GPUs
    `https://www.reddit.com/r/hardwareswap/search.rss?q=GPU+OR+RTX+OR+GTX+OR+NVIDIA+OR+graphics+card&sort=new&t=${timeParam}`,
    `https://www.reddit.com/r/hardwareswap/search.rss?q=RTX+4090+OR+RTX+5090+OR+RTX+3090+OR+A100+OR+H100&sort=new&t=${timeParam}`,
    // Build a PC sales
    `https://www.reddit.com/r/buildapcsales/search.rss?q=GPU+OR+RTX+OR+graphics+card&sort=new&t=${timeParam}`,
    // GPU market specific
    `https://www.reddit.com/r/gpumarket/search.rss?q=sell+OR+selling+OR+WTS&sort=new&t=${timeParam}`,
    // Server homelabsales
    `https://www.reddit.com/r/homelabsales/search.rss?q=GPU+OR+NVIDIA+OR+RTX&sort=new&t=${timeParam}`,
  ];

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      // Parse Atom entries
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;
      while ((match = entryRegex.exec(xml)) !== null) {
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
        const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()) : '';
        const link = linkMatch ? linkMatch[1] : '';

        if (!title || title.length < 10) continue;
        if (!hardFilter(title)) continue;

        const gpuModel = detectGPUModel(title) || 'GPU';
        const priceMatch = title.match(/\$([0-9,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
        const quantity = detectQuantity(title);

        const listing: GpuListing = {
          title: title.slice(0, 150),
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

  console.log(`[Reddit] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── Best Buy API ────────────────────────────────────────

async function scrapeBestBuy(): Promise<GpuListing[]> {
  const apiKey = process.env.BESTBUY_API_KEY;
  const listings: GpuListing[] = [];

  // Works without API key via RSS, or with key via API
  if (apiKey) {
    try {
      const url = `https://api.bestbuy.com/v1/products((categoryPath.id=abcat0507002)&onSale=true)?apiKey=${apiKey}&sort=onSale.desc&show=sku,name,salePrice,regularPrice,url,condition,manufacturer&pageSize=50&format=json`;
      const res = await fetch(url);
      if (!res.ok) { console.error(`[Best Buy] API ${res.status}`); return []; }
      const data = await res.json();

      for (const item of data.products || []) {
        const title = item.name || '';
        if (!hardFilter(title)) continue;

        const gpuModel = detectGPUModel(title) || 'GPU';
        const price = item.salePrice || item.regularPrice || 0;
        const savings = (item.regularPrice || 0) - (item.salePrice || 0);

        const listing: GpuListing = {
          title: `${title}${savings > 0 ? ` (Save $${savings})` : ''}`.slice(0, 150),
          price, pricePerUnit: price, quantity: 1,
          gpuModel, condition: item.condition || 'New', seller: 'Best Buy',
          link: item.url || '', source: 'bestbuy', foundAt: new Date().toISOString(), score: 0,
        };
        listing.score = scoreListing(listing) + (savings > 50 ? 20 : 0);
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[Best Buy] Error:`, (err as Error).message);
    }
  } else {
    // Fallback: Best Buy deals RSS
    try {
      const url = 'https://www.bestbuy.com/rss/deals/category/abcat0507002';
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) return [];
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && listings.length < 20) {
        const block = match[1];
        const title = decodeEntities(extractTag(block, 'title'));
        const link = extractTag(block, 'link');
        if (!title || !hardFilter(title)) continue;

        const gpuModel = detectGPUModel(title) || 'GPU';
        const priceMatch = title.match(/\$([0-9,]+\.?\d*)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

        const listing: GpuListing = {
          title: title.slice(0, 150), price, pricePerUnit: price, quantity: 1,
          gpuModel, condition: 'New', seller: 'Best Buy',
          link, source: 'bestbuy', foundAt: new Date().toISOString(), score: 0,
        };
        listing.score = scoreListing(listing);
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[Best Buy RSS] Error:`, (err as Error).message);
    }
  }

  console.log(`[Best Buy] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── Newegg RSS ──────────────────────────────────────────

async function scrapeNewegg(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  const feeds = [
    'https://www.newegg.com/product/rss?N=100007709&IsNodeId=1&name=Desktop-Graphics-Cards',
    'https://www.newegg.com/product/rss?N=100007709%204814&IsNodeId=1&name=NVIDIA-Desktop-Graphics-Cards',
  ];

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && listings.length < 30) {
        const block = match[1];
        const title = decodeEntities(extractTag(block, 'title'));
        const link = extractTag(block, 'link');
        const desc = extractTag(block, 'description');

        if (!title || !hardFilter(title)) continue;

        const gpuModel = detectGPUModel(title) || 'GPU';
        const priceMatch = (title + ' ' + desc).match(/\$([0-9,]+\.?\d*)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

        const listing: GpuListing = {
          title: title.slice(0, 150), price, pricePerUnit: price, quantity: 1,
          gpuModel, condition: 'New', seller: 'Newegg',
          link: link || '', source: 'newegg', foundAt: new Date().toISOString(), score: 0,
        };
        listing.score = scoreListing(listing);
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[Newegg] Error:`, (err as Error).message);
    }
  }

  console.log(`[Newegg] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── PCPartPicker RSS ────────────────────────────────────

async function scrapePCPartPicker(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];

  try {
    const url = 'https://pcpartpicker.com/products/video-card/overall-list/';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Parse product rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null && listings.length < 30) {
      const row = match[1];
      const nameMatch = row.match(/<a[^>]*href="(\/product\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!nameMatch) continue;

      const link = `https://pcpartpicker.com${nameMatch[1]}`;
      const title = nameMatch[2].replace(/<[^>]+>/g, '').trim();
      if (!title || !hardFilter(title)) continue;

      const gpuModel = detectGPUModel(title) || 'GPU';
      const priceMatch = row.match(/\$([0-9,]+\.?\d*)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

      const listing: GpuListing = {
        title: title.slice(0, 150), price, pricePerUnit: price, quantity: 1,
        gpuModel, condition: 'New', seller: 'PCPartPicker',
        link, source: 'pcpartpicker', foundAt: new Date().toISOString(), score: 0,
      };
      listing.score = scoreListing(listing);
      listings.push(listing);
    }
  } catch (err) {
    console.error(`[PCPartPicker] Error:`, (err as Error).message);
  }

  console.log(`[PCPartPicker] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── Slickdeals RSS (GPU deals) ──────────────────────────

async function scrapeSlickdeals(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];

  try {
    const url = 'https://feeds.feedburner.com/SlickdealsnetFP?format=xml';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && listings.length < 15) {
      const block = match[1];
      const title = decodeEntities(extractTag(block, 'title'));
      const link = extractTag(block, 'link');

      if (!title || !hardFilter(title)) continue;

      const gpuModel = detectGPUModel(title) || 'GPU';
      const priceMatch = title.match(/\$([0-9,]+\.?\d*)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

      const listing: GpuListing = {
        title: title.slice(0, 150), price, pricePerUnit: price, quantity: 1,
        gpuModel, condition: 'Deal', seller: 'Slickdeals',
        link: link || '', source: 'slickdeals', foundAt: new Date().toISOString(), score: 0,
      };
      listing.score = scoreListing(listing) + 15; // Bonus for being a confirmed deal
      listings.push(listing);
    }
  } catch (err) {
    console.error(`[Slickdeals] Error:`, (err as Error).message);
  }

  console.log(`[Slickdeals] Found ${listings.length} GPU deals`);
  return listings;
}

// ─── Google Shopping/News for GPU bulk sales ─────────────

async function scrapeGoogleGpuDeals(newsDays: string): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  const queries = [
    'GPU bulk lot sale NVIDIA',
    'RTX 4090 wholesale bulk',
    'datacenter GPU liquidation',
    'GPU server decommission sale',
    'NVIDIA GPU lot auction',
    'bulk graphics card sale',
    'used GPU lot wholesale',
    'enterprise GPU surplus sale',
  ];

  const now = Date.now();
  const picked = queries
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 53) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 4);

  for (const query of picked) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ` when:${newsDays}`)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = decodeEntities(extractTag(block, 'title'));
        const linkRaw = extractTag(block, 'link');
        const source = decodeEntities(extractTag(block, 'source'));

        if (!title || title.length < 15) continue;
        if (!hardFilter(title)) continue;

        const gpuModel = detectGPUModel(title) || 'GPU';

        const listing: GpuListing = {
          title: title.slice(0, 150),
          price: 0, pricePerUnit: 0, quantity: 1,
          gpuModel, condition: 'News', seller: source || 'Google News',
          link: linkRaw, source: 'google', foundAt: new Date().toISOString(), score: 0,
        };
        listing.score = scoreListing(listing) + 10;
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[Google] Error:`, (err as Error).message);
    }
  }

  console.log(`[Google] Found ${listings.length} GPU-related items`);
  return listings;
}

// ─── Swappa (used electronics marketplace) ───────────────

async function scrapeSwappa(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  const searches = ['nvidia-gpu', 'rtx-4090', 'rtx-3090', 'rtx-5090'];

  for (const search of searches) {
    try {
      const url = `https://swappa.com/buy/search?q=${search}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Parse listing cards
      const cardRegex = /<a[^>]*href="(\/listing\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = cardRegex.exec(html)) !== null && listings.length < 20) {
        const link = `https://swappa.com${match[1]}`;
        const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!hardFilter(text) || text.length < 10) continue;

        const gpuModel = detectGPUModel(text) || 'GPU';
        const priceMatch = text.match(/\$([0-9,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

        const listing: GpuListing = {
          title: text.slice(0, 150),
          price, pricePerUnit: price, quantity: 1,
          gpuModel, condition: 'Used', seller: 'Swappa',
          link, source: 'swappa', foundAt: new Date().toISOString(), score: 0,
        };
        listing.score = scoreListing(listing);
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[Swappa] Error:`, (err as Error).message);
    }
  }

  console.log(`[Swappa] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── BidSpotter ──────────────────────────────────────────

async function scrapeBidSpotter(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  try {
    const url = 'https://www.bidspotter.com/en-us/search?query=NVIDIA+GPU';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const lotRegex = /<a[^>]*href="(\/en-us\/auction-catalogues\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = lotRegex.exec(html)) !== null && listings.length < 15) {
      const link = `https://www.bidspotter.com${match[1]}`;
      const text = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!hardFilter(text)) continue;
      const gpuModel = detectGPUModel(text) || 'GPU';
      const priceMatch = text.match(/\$([0-9,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
      const quantity = detectQuantity(text);
      const listing: GpuListing = {
        title: text.slice(0, 150), price, pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
        quantity, gpuModel, condition: 'Auction', seller: 'BidSpotter',
        link, source: 'bidspotter', foundAt: new Date().toISOString(), score: 0,
      };
      listing.score = scoreListing(listing);
      listings.push(listing);
    }
  } catch (err) { console.error(`[BidSpotter] Error:`, (err as Error).message); }
  console.log(`[BidSpotter] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── HiBid ───────────────────────────────────────────────

async function scrapeHiBid(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  try {
    const url = 'https://www.hibid.com/search?q=NVIDIA+GPU+lot';
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
      if (!hardFilter(text)) continue;
      const gpuModel = detectGPUModel(text) || 'GPU';
      const priceMatch = text.match(/\$([0-9,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
      const listing: GpuListing = {
        title: text.slice(0, 150), price, pricePerUnit: price,
        quantity: 1, gpuModel, condition: 'Auction', seller: 'HiBid',
        link, source: 'hibid', foundAt: new Date().toISOString(), score: 0,
      };
      listing.score = scoreListing(listing);
      listings.push(listing);
    }
  } catch (err) { console.error(`[HiBid] Error:`, (err as Error).message); }
  console.log(`[HiBid] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── GovDeals ────────────────────────────────────────────

async function scrapeGovDeals(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  try {
    const url = 'https://www.govdeals.com/index.cfm?fa=Main.AdvSearchResultsNew&searchPg=Category&additession=&category=00&description=GPU+NVIDIA&min_price=0&max_price=0';
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
      if (!hardFilter(text)) continue;
      const gpuModel = detectGPUModel(text) || 'GPU';
      const priceMatch = text.match(/\$([0-9,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
      const listing: GpuListing = {
        title: text.slice(0, 150), price, pricePerUnit: price,
        quantity: 1, gpuModel, condition: 'Government Surplus', seller: 'GovDeals',
        link, source: 'govdeals', foundAt: new Date().toISOString(), score: 0,
      };
      listing.score = scoreListing(listing) + 30;
      listings.push(listing);
    }
  } catch (err) { console.error(`[GovDeals] Error:`, (err as Error).message); }
  console.log(`[GovDeals] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── Craigslist RSS ──────────────────────────────────────

async function scrapeCraigslist(): Promise<GpuListing[]> {
  const listings: GpuListing[] = [];
  // Major cities
  const cities = ['sfbay', 'losangeles', 'newyork', 'seattle', 'chicago', 'dallas', 'atlanta', 'miami'];

  const picked = cities.slice(0, 3); // 3 cities per run

  for (const city of picked) {
    try {
      const url = `https://${city}.craigslist.org/search/sss?query=GPU+NVIDIA+lot&format=rss`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = decodeEntities(extractTag(block, 'title'));
        const link = extractTag(block, 'link');

        if (!title || title.length < 10) continue;
        if (!hardFilter(title)) continue;

        const gpuModel = detectGPUModel(title) || 'GPU';
        const priceMatch = title.match(/\$([0-9,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
        const quantity = detectQuantity(title);

        const listing: GpuListing = {
          title: title.slice(0, 150),
          price, pricePerUnit: quantity > 1 && price > 0 ? Math.round(price / quantity) : price,
          quantity, gpuModel, condition: 'Used', seller: `Craigslist ${city}`,
          link: link || '', source: 'craigslist', foundAt: new Date().toISOString(), score: 0,
        };
        listing.score = scoreListing(listing);
        listings.push(listing);
      }
    } catch (err) {
      console.error(`[Craigslist ${city}] Error:`, (err as Error).message);
    }
  }

  console.log(`[Craigslist] Found ${listings.length} GPU listings`);
  return listings;
}

// ─── Main Scanner ────────────────────────────────────────

export async function scanForGpuDeals(range: string = 'today'): Promise<{
  listings: GpuListing[];
  totalScanned: number;
  queriesUsed: string[];
  sources: Record<string, number>;
}> {
  const redditTime = range === 'week' ? 'week' : range === '3d' ? 'week' : 'day';
  const newsDays = range === 'week' ? '7d' : range === '3d' ? '3d' : '1d';

  // Run ALL sources in parallel
  const [reddit, bestbuy, newegg, pcpartpicker, slickdeals, google, swappa, bidspotter, hibid, govdeals, craigslist] = await Promise.all([
    scrapeReddit(redditTime),
    scrapeBestBuy(),
    scrapeNewegg(),
    scrapePCPartPicker(),
    scrapeSlickdeals(),
    scrapeGoogleGpuDeals(newsDays),
    scrapeSwappa(),
    scrapeBidSpotter(),
    scrapeHiBid(),
    scrapeGovDeals(),
    scrapeCraigslist(),
  ]);

  const sources: Record<string, number> = {
    reddit: reddit.length,
    bestbuy: bestbuy.length,
    newegg: newegg.length,
    pcpartpicker: pcpartpicker.length,
    slickdeals: slickdeals.length,
    google: google.length,
    swappa: swappa.length,
    bidspotter: bidspotter.length,
    hibid: hibid.length,
    govdeals: govdeals.length,
    craigslist: craigslist.length,
  };

  const allListings = [...reddit, ...bestbuy, ...newegg, ...pcpartpicker, ...slickdeals, ...google, ...swappa, ...bidspotter, ...hibid, ...govdeals, ...craigslist];
  const totalScanned = allListings.length;

  console.log(`[GPU] Total: ${totalScanned} | Sources: ${Object.entries(sources).map(([k, v]) => `${k}=${v}`).join(', ')}`);

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
