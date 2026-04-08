/**
 * Detects and monitors companies selling GPUs in the USA.
 * Extracts real company names from news, Reddit, and Craigslist.
 * All RSS-based — works on both local and Vercel.
 */

import type { CompanyLead } from './types';

// ─── Known GPU companies to watch ────────────────────────

const KNOWN_COMPANIES = [
  'Iron Mountain', 'TES', 'Sims Lifecycle', 'ITRenew', 'Apto Solutions',
  'ER2', 'CentricsIT', 'Curvature', 'Park Place Technologies', 'Evernex',
  'ServerMonkey', 'Maxxum', 'EPC Group', 'Wisetek', 'Cascade Asset Management',
  'DataServ', 'NCS Global', 'Procurri', 'Dynamic Lifecycle', 'Arrow Electronics',
  'Ingram Micro', 'TD Synnex', 'SHI International', 'CDW', 'Newegg Business',
  'Dell Refurbished', 'HP Renew', 'Lenovo Outlet', 'SuperMicro',
  'Lambda Labs', 'CoreWeave', 'Voltage Park', 'FluidStack',
  'BidFTA', 'GovDeals', 'GovPlanet', 'Ritchie Bros', 'Heritage Global',
];

// News outlets to exclude (they report, not sell)
const NEWS_OUTLETS = [
  'reuters', 'bloomberg', 'cnbc', 'techcrunch', 'the verge', 'ars technica',
  'tom\'s hardware', 'anandtech', 'wccftech', 'videocardz', 'pc gamer',
  'pcworld', 'engadget', 'cnet', 'zdnet', 'techradar', 'digital trends',
  'notebookcheck', 'kitguru', 'overclock3d', 'guru3d', 'hot hardware',
  'neowin', 'xda', 'android authority', 'ign', 'gamespot', 'kotaku',
  'bbc', 'cnn', 'nytimes', 'washington post', 'forbes', 'business insider',
];

// ─── Helpers ─────────────────────────────────────────────

const GPU_KEYWORDS = ['gpu', 'nvidia', 'rtx', 'gtx', 'a100', 'h100', 'a6000', 'graphics card', 'geforce', 'quadro', 'tesla v100'];
const GPU_MODELS_LIST = ['H200', 'H100', 'B200', 'L40S', 'L40', 'A100', 'A6000', 'V100', 'RTX 5090', 'RTX 4090', 'RTX 3090', 'RTX 5080', 'RTX 4080'];
const SELL_KEYWORDS = ['sell', 'selling', 'sale', 'liquidat', 'auction', 'wholesale', 'bulk', 'lot', 'surplus', 'decommission', 'clearance', 'inventory', 'overstock', 'refurbish', 'buyback', 'dispose', 'offload'];
const COMPANY_SUFFIXES = ['inc', 'llc', 'corp', 'ltd', 'co.', 'company', 'technologies', 'solutions', 'services', 'group', 'systems', 'partners', 'global', 'international', 'enterprises'];

function detectGpuModels(text: string): string {
  const upper = text.toUpperCase();
  const found = GPU_MODELS_LIST.filter(m => upper.includes(m));
  return found.length > 0 ? found.join(', ') : 'Various';
}

function isGpuRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return GPU_KEYWORDS.some(kw => lower.includes(kw));
}

function isSellingGpus(text: string): boolean {
  const lower = text.toLowerCase();
  return SELL_KEYWORDS.some(kw => lower.includes(kw));
}

function isNewsOutlet(name: string): boolean {
  const lower = name.toLowerCase();
  return NEWS_OUTLETS.some(outlet => lower.includes(outlet));
}

/**
 * Extract company name from text.
 * Looks for known patterns: "Company Inc", "Company LLC", proper nouns, etc.
 */
function extractCompanyName(title: string, source: string): string | null {
  // Check if source itself is a company (not a news outlet)
  if (source && !isNewsOutlet(source) && source.length > 2) {
    // Check for company suffixes in source
    const sourceLower = source.toLowerCase();
    if (COMPANY_SUFFIXES.some(s => sourceLower.includes(s))) {
      return source.trim();
    }
  }

  // Check for known companies in the title
  for (const company of KNOWN_COMPANIES) {
    if (title.toLowerCase().includes(company.toLowerCase())) {
      return company;
    }
  }

  // Extract "Company Name Inc/LLC/Corp" patterns from title
  const companyPattern = /([A-Z][\w&\s'-]{2,30})\s+(Inc\.?|LLC|Corp\.?|Ltd\.?|Company|Technologies|Solutions|Services|Group|Systems|Partners|Global|International|Enterprises)/gi;
  const match = title.match(companyPattern);
  if (match) {
    return match[0].trim();
  }

  // Extract quoted company names: "Company Name" announces...
  const quotedMatch = title.match(/"([^"]{3,40})"/);
  if (quotedMatch && !isNewsOutlet(quotedMatch[1])) {
    return quotedMatch[1];
  }

  // Look for "CompanyName, a GPU/ITAD/tech company"
  const descriptiveMatch = title.match(/^([A-Z][\w\s&'-]{2,30}),?\s+(?:a |the |an )/);
  if (descriptiveMatch && !isNewsOutlet(descriptiveMatch[1])) {
    return descriptiveMatch[1].trim();
  }

  // If source is not a known news outlet, use it as company name
  if (source && !isNewsOutlet(source) && source.length > 2 && source.length < 40) {
    return source;
  }

  return null;
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

function classifyCompany(text: string): { type: string; priority: 'High' | 'Medium' | 'Low' } {
  const lower = text.toLowerCase();
  if (lower.includes('itad') || lower.includes('asset disposition') || lower.includes('decommission')) return { type: 'ITAD', priority: 'High' };
  if (lower.includes('liquidat') || lower.includes('surplus') || lower.includes('clearance')) return { type: 'Liquidator', priority: 'High' };
  if (lower.includes('auction') || lower.includes('bid')) return { type: 'Auction', priority: 'High' };
  if (lower.includes('wholesale') || lower.includes('bulk') || lower.includes('lot')) return { type: 'Wholesale', priority: 'High' };
  if (lower.includes('refurbish') || lower.includes('renew') || lower.includes('certified')) return { type: 'Refurbisher', priority: 'Medium' };
  if (lower.includes('resell') || lower.includes('distributor') || lower.includes('supplier')) return { type: 'Reseller', priority: 'Medium' };
  return { type: 'Seller', priority: 'Medium' };
}

// ─── Google News: Companies selling GPUs ─────────────────

async function findFromGoogleNews(): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = [];

  const queries = [
    'company selling GPU bulk USA',
    'GPU liquidation company',
    'datacenter GPU decommission company',
    'ITAD GPU inventory sale',
    'enterprise GPU wholesale company',
    'GPU auction company bulk',
    'company selling NVIDIA RTX 4090 wholesale',
    'GPU supplier USA bulk wholesale',
    'datacenter equipment liquidation GPU company',
    'refurbished GPU wholesale company',
  ];

  const now = Date.now();
  const picked = queries
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 47.3) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 5);

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
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = decodeEntities(extractTag(block, 'title'));
        const link = extractTag(block, 'link');
        const source = decodeEntities(extractTag(block, 'source'));

        if (!title || title.length < 15) continue;

        // Must be GPU-related AND about selling
        if (!isGpuRelated(title) && !isGpuRelated(source)) continue;

        // Try to extract a real company name
        const company = extractCompanyName(title, source);
        if (!company) continue;
        if (isNewsOutlet(company)) continue;

        const { type, priority } = classifyCompany(title + ' ' + source);

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

// ─── Reddit: Companies & sellers posting GPU sales ───────

async function findFromReddit(): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = [];

  const feeds = [
    'https://www.reddit.com/r/hardwareswap/search.rss?q=selling+GPU+bulk+OR+lot+OR+wholesale+OR+company&sort=new&t=week',
    'https://www.reddit.com/r/homelabsales/search.rss?q=selling+GPU+OR+NVIDIA+server&sort=new&t=week',
    'https://www.reddit.com/r/sysadmin/search.rss?q=GPU+decommission+OR+surplus+OR+liquidation+OR+selling&sort=new&t=month',
    'https://www.reddit.com/r/NVIDIA/search.rss?q=where+to+buy+bulk+GPU+OR+wholesale+OR+company&sort=new&t=month',
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
        const authorMatch = block.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/);
        const contentMatch = block.match(/<content[^>]*>([\s\S]*?)<\/content>/);

        const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()) : '';
        const link = linkMatch ? linkMatch[1] : '';
        const author = authorMatch ? authorMatch[1].trim() : '';
        const content = contentMatch ? contentMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

        if (!title) continue;
        if (!isGpuRelated(title) && !isGpuRelated(content)) continue;

        // Try to find a company name in the post
        const fullText = title + ' ' + content;
        const company = extractCompanyName(fullText, '') || (author ? `u/${author}` : null);
        if (!company) continue;

        // Check if it's about selling
        const isSelling = isSellingGpus(title) || isSellingGpus(content);
        const { type, priority } = classifyCompany(fullText);

        leads.push({
          company,
          website: link,
          type: isSelling ? type : 'Seller',
          description: title.slice(0, 200),
          location: 'USA',
          gpuModels: detectGpuModels(fullText),
          priority: isSelling ? priority : 'Medium',
          notes: 'Reddit',
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
    { id: 'austin', name: 'Austin, TX' },
    { id: 'portland', name: 'Portland, OR' },
  ];

  const now = Date.now();
  const picked = cities
    .map((c, i) => ({ ...c, sort: Math.sin(now / 1000 + i * 23.7) }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 4);

  for (const city of picked) {
    try {
      const url = `https://${city.id}.craigslist.org/search/sss?query=GPU+NVIDIA+selling&format=rss`;
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

        if (!title || !isGpuRelated(title)) continue;

        // Try to detect if it's a business (not individual)
        const company = extractCompanyName(title, '') || `GPU Seller — ${city.name}`;
        const { type, priority } = classifyCompany(title);

        leads.push({
          company,
          website: link,
          type,
          description: title,
          location: city.name,
          gpuModels: detectGpuModels(title),
          priority,
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
  const [newsLeads, redditLeads, clLeads] = await Promise.all([
    findFromGoogleNews(),
    findFromReddit(),
    findFromCraigslist(),
  ]);

  const allLeads = [...newsLeads, ...redditLeads, ...clLeads];

  console.log(`[Leads] Total: ${allLeads.length} | News=${newsLeads.length}, Reddit=${redditLeads.length}, Craigslist=${clLeads.length}`);

  // Dedup by company name (case-insensitive)
  const seen = new Set<string>();
  const deduped = allLeads.filter(l => {
    const key = l.company.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: High priority first, then by type
  deduped.sort((a, b) => {
    const p = { High: 3, Medium: 2, Low: 1 };
    return (p[b.priority] || 0) - (p[a.priority] || 0);
  });

  return deduped;
}
