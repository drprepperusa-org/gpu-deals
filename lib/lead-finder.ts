/**
 * Monitors companies selling GPUs worldwide.
 * Uses Google News RSS, Reddit, and Craigslist to find
 * businesses actively selling or liquidating GPU inventory.
 * All RSS-based — works on Vercel.
 */

import type { CompanyLead } from './types';

// ─── GPU keywords for matching ───────────────────────────

const GPU_KEYWORDS = ['gpu', 'nvidia', 'rtx 4090', 'rtx 5090', 'rtx 3090', 'a100', 'h100', 'a6000', 'graphics card', 'geforce'];
const GPU_MODELS_LIST = ['H100', 'A100', 'RTX 4090', 'RTX 5090', 'RTX 3090', 'A6000', 'V100', 'L40', 'H200', 'B200'];

function detectGpuModels(text: string): string {
  const upper = text.toUpperCase();
  const found = GPU_MODELS_LIST.filter(m => upper.includes(m));
  return found.length > 0 ? found.join(', ') : 'Various';
}

function isGpuRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return GPU_KEYWORDS.some(kw => lower.includes(kw));
}

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

// ─── Google News: Companies selling/liquidating GPUs ─────

async function findFromGoogleNews(): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = [];

  const queries = [
    'company selling bulk GPU',
    'GPU liquidation company USA',
    'datacenter GPU decommission sale',
    'ITAD company GPU inventory',
    'enterprise GPU reseller wholesale',
    'GPU auction company bulk lot',
    'company selling NVIDIA RTX 4090 bulk',
    'GPU wholesaler USA',
    'datacenter equipment liquidation GPU',
    'bulk GPU supplier company',
  ];

  const now = Date.now();
  const picked = queries
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 47.3) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 4);

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
      while ((match = itemRegex.exec(xml)) !== null && leads.length < 20) {
        const block = match[1];
        const title = decodeEntities(extractTag(block, 'title'));
        const link = extractTag(block, 'link');
        const source = decodeEntities(extractTag(block, 'source'));

        if (!title || title.length < 15) continue;
        if (!isGpuRelated(title)) continue;

        // Extract company name from the source or title
        const company = source || title.split(' - ')[0].split(' | ')[0].trim().slice(0, 60);

        let type = 'News';
        const lower = title.toLowerCase();
        if (lower.includes('liquidat')) type = 'Liquidator';
        else if (lower.includes('auction')) type = 'Auction';
        else if (lower.includes('itad') || lower.includes('decommission')) type = 'ITAD';
        else if (lower.includes('wholesale') || lower.includes('bulk') || lower.includes('sell')) type = 'Reseller';

        let priority: 'High' | 'Medium' | 'Low' = 'Medium';
        if (lower.includes('bulk') || lower.includes('lot') || lower.includes('liquidat')) priority = 'High';

        leads.push({
          company,
          website: link,
          type,
          description: title,
          location: 'USA',
          gpuModels: detectGpuModels(title),
          priority,
          notes: `Google News: "${query}"`,
          foundAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[News Leads] Error:`, (err as Error).message);
    }
  }

  console.log(`[News Leads] Found ${leads.length} companies`);
  return leads;
}

// ─── Google Alerts style: ITAD & Liquidation companies ───

async function findFromGoogleAlerts(): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = [];

  const queries = [
    'ITAD GPU services USA',
    'IT asset disposition NVIDIA',
    'datacenter hardware liquidator',
    'GPU buyback program company',
    'refurbished enterprise GPU supplier',
    'server decommission GPU wholesale',
  ];

  const now = Date.now();
  const picked = queries
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 31.7) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 3);

  for (const query of picked) {
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:30d')}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && leads.length < 15) {
        const block = match[1];
        const title = decodeEntities(extractTag(block, 'title'));
        const link = extractTag(block, 'link');
        const source = decodeEntities(extractTag(block, 'source'));

        if (!title || title.length < 15) continue;

        const company = source || title.split(' - ')[0].trim().slice(0, 60);
        const lower = title.toLowerCase();

        let type = 'Reseller';
        if (lower.includes('itad') || lower.includes('asset disposition') || lower.includes('decommission')) type = 'ITAD';
        else if (lower.includes('liquidat')) type = 'Liquidator';
        else if (lower.includes('auction')) type = 'Auction';

        leads.push({
          company,
          website: link,
          type,
          description: title,
          location: 'USA',
          gpuModels: detectGpuModels(title),
          priority: type === 'ITAD' || type === 'Liquidator' ? 'High' : 'Medium',
          notes: `Google Alerts: "${query}"`,
          foundAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[Alerts Leads] Error:`, (err as Error).message);
    }
  }

  console.log(`[Alerts Leads] Found ${leads.length} companies`);
  return leads;
}

// ─── Reddit: Companies posting GPU sales ─────────────────

async function findFromReddit(): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = [];

  const feeds = [
    'https://www.reddit.com/r/hardwareswap/search.rss?q=selling+GPU+bulk+OR+lot+OR+wholesale&sort=new&t=week',
    'https://www.reddit.com/r/homelabsales/search.rss?q=selling+GPU+OR+NVIDIA&sort=new&t=week',
    'https://www.reddit.com/r/sysadmin/search.rss?q=GPU+decommission+OR+surplus+OR+liquidation&sort=new&t=month',
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
      while ((match = entryRegex.exec(xml)) !== null && leads.length < 10) {
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
        const authorMatch = block.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/);

        const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()) : '';
        const link = linkMatch ? linkMatch[1] : '';
        const author = authorMatch ? authorMatch[1].trim() : 'Reddit User';

        if (!title || !isGpuRelated(title)) continue;

        leads.push({
          company: `u/${author}`,
          website: link,
          type: 'Reseller',
          description: title.slice(0, 200),
          location: 'USA',
          gpuModels: detectGpuModels(title),
          priority: title.toLowerCase().includes('bulk') || title.toLowerCase().includes('lot') ? 'High' : 'Medium',
          notes: 'Reddit seller',
          foundAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[Reddit Leads] Error:`, (err as Error).message);
    }
  }

  console.log(`[Reddit Leads] Found ${leads.length} sellers`);
  return leads;
}

// ─── Craigslist: Businesses selling GPUs in US cities ────

async function findFromCraigslist(): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = [];
  const cities = [
    { id: 'sfbay', name: 'San Francisco, CA' },
    { id: 'losangeles', name: 'Los Angeles, CA' },
    { id: 'newyork', name: 'New York, NY' },
    { id: 'seattle', name: 'Seattle, WA' },
    { id: 'chicago', name: 'Chicago, IL' },
    { id: 'dallas', name: 'Dallas, TX' },
    { id: 'atlanta', name: 'Atlanta, GA' },
    { id: 'miami', name: 'Miami, FL' },
    { id: 'denver', name: 'Denver, CO' },
    { id: 'phoenix', name: 'Phoenix, AZ' },
  ];

  // Pick 4 cities per run
  const now = Date.now();
  const picked = cities
    .map((c, i) => ({ ...c, sort: Math.sin(now / 1000 + i * 23.7) }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 4);

  for (const city of picked) {
    try {
      const url = `https://${city.id}.craigslist.org/search/sss?query=GPU+NVIDIA+bulk&format=rss`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPUDeals/1.0)' },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && leads.length < 15) {
        const block = match[1];
        const title = decodeEntities(extractTag(block, 'title'));
        const link = extractTag(block, 'link');

        if (!title || !isGpuRelated(title)) continue;

        leads.push({
          company: `Craigslist Seller — ${city.name}`,
          website: link,
          type: 'Reseller',
          description: title,
          location: city.name,
          gpuModels: detectGpuModels(title),
          priority: title.toLowerCase().includes('bulk') || title.toLowerCase().includes('lot') ? 'High' : 'Medium',
          notes: `Craigslist ${city.id}`,
          foundAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[CL ${city.id}] Error:`, (err as Error).message);
    }
  }

  console.log(`[Craigslist Leads] Found ${leads.length} sellers`);
  return leads;
}

// ─── Main: Find all GPU companies ────────────────────────

export async function findGpuCompanies(): Promise<CompanyLead[]> {
  const [newsLeads, alertsLeads, redditLeads, clLeads] = await Promise.all([
    findFromGoogleNews(),
    findFromGoogleAlerts(),
    findFromReddit(),
    findFromCraigslist(),
  ]);

  const allLeads = [...newsLeads, ...alertsLeads, ...redditLeads, ...clLeads];

  console.log(`[Leads] Total: ${allLeads.length} | News=${newsLeads.length}, Alerts=${alertsLeads.length}, Reddit=${redditLeads.length}, Craigslist=${clLeads.length}`);

  // Dedup by website/link
  const seen = new Set<string>();
  const deduped = allLeads.filter(l => {
    const key = l.website.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: High priority first
  deduped.sort((a, b) => {
    const p = { High: 3, Medium: 2, Low: 1 };
    return (p[b.priority] || 0) - (p[a.priority] || 0);
  });

  return deduped;
}
