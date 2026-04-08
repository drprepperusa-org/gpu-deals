/**
 * Company Scanner — finds businesses selling bulk GPUs.
 * Uses Google Custom Search API, USASpending.gov, SEC EDGAR.
 * Focus: B2B leads, not individual listings.
 */

import type { CompanyLead } from './types';

// ─── Hard Filter — GPU only, reject everything else ──────

const REJECT_TERMS = [
  'laptop', 'notebook', 'macbook', 'chromebook', 'ultrabook',
  'desktop computer', 'complete system', 'complete pc', 'gaming pc',
  'workstation pc', 'all-in-one', 'mini pc', 'nuc',
  // Laptop model patterns (CPU + GPU combos = laptop)
  'i5 12', 'i7 12', 'i9 12', 'i5 13', 'i7 13', 'i9 13', 'i5 14', 'i7 14', 'i9 14',
  'i5-12', 'i7-12', 'i9-12', 'i5-13', 'i7-13', 'i9-13', 'i5-14', 'i7-14', 'i9-14',
  '12450h', '12500h', '12700h', '12900h', '13450h', '13500h', '13620h', '13700h', '13900h',
  '14500h', '14700h', '14900h', '12650h', '13650h', '14650h',
  'under warranty', 'warranty until',
  // Laptop brands/models
  'thinkpad', 'lenovo legion', 'dell g15', 'dell g16', 'asus rog', 'msi stealth',
  'msi raider', 'acer nitro', 'acer predator', 'hp omen', 'hp victus',
  'alienware m', 'razer blade', 'colorful evol', 'gigabyte aero', 'gigabyte g5',
  'asus tuf', 'asus zephyrus', 'msi pulse', 'msi katana', 'msi cyborg',
  'rtx 4050', 'rtx 4060 laptop', 'rtx 3050', 'rtx 3060 laptop',
  'cpu', 'processor', 'xeon', 'ryzen', 'threadripper', 'core i7', 'core i9', 'core i5', 'epyc',
  'motherboard', 'mainboard', 'mobo',
  'ram only', 'memory only', 'ddr4', 'ddr5',
  'ssd only', 'nvme only', 'hard drive', 'hdd',
  'power supply', 'psu only',
  'case only', 'chassis', 'enclosure',
  'monitor only', 'display only', 'screen only',
  'keyboard', 'mouse only', 'printer', 'scanner',
  'cable only', 'adapter only', 'riser only',
  'broken', 'for parts', 'not working', 'as-is', 'damaged', 'defective',
  'empty box', 'box only', 'no gpu', 'without gpu',
  'fan only', 'heatsink only', 'bracket only', 'backplate only',
  'mixed electronics', 'office equipment',
  'software', 'license', 'subscription', 'cloud credits', 'rental',
];

const GPU_CONFIRM_TERMS = [
  'gpu', 'graphics card', 'video card',
  'rtx', 'gtx', 'geforce', 'radeon',
  'nvidia', 'quadro', 'tesla v100', 'tesla p100', 'tesla t4',
  'a100', 'a6000', 'a5000', 'a4000', 'h100', 'h200', 'b200',
  'l40', 'l40s',
];

function isGpuOnly(text: string): boolean {
  const lower = text.toLowerCase();
  // Reject if contains non-GPU terms
  if (REJECT_TERMS.some(term => lower.includes(term))) return false;
  // Must contain at least one GPU term
  return GPU_CONFIRM_TERMS.some(term => lower.includes(term));
}

// ─── Known companies to always flag ──────────────────────

const KNOWN_GPU_COMPANIES = [
  'Iron Mountain', 'Sims Lifecycle', 'ITRenew', 'Apto Solutions',
  'ER2', 'CentricsIT', 'Curvature', 'Park Place Technologies',
  'ServerMonkey', 'Maxxum', 'Wisetek', 'Cascade Asset Management',
  'NCS Global', 'Procurri', 'Dynamic Lifecycle', 'Arrow Electronics',
  'Ingram Micro', 'TD Synnex', 'SHI International', 'CDW',
  'Lambda Labs', 'CoreWeave', 'Voltage Park',
  'Heritage Global', 'Ritchie Bros', 'Liquidity Services',
  'TES', 'EPC Group', 'Evernex', 'DataServ',
];

const NEWS_OUTLETS = [
  'reuters', 'bloomberg', 'cnbc', 'techcrunch', 'the verge',
  'tom\'s hardware', 'anandtech', 'wccftech', 'videocardz', 'pc gamer',
  'engadget', 'cnet', 'zdnet', 'techradar', 'bbc', 'cnn', 'forbes',
  'business insider', 'nytimes', 'wikipedia', 'reddit', 'youtube',
  'facebook', 'twitter', 'linkedin', 'amazon', 'ebay', 'newegg',
  'best buy', 'walmart',
];

const GPU_MODELS = ['H200', 'H100', 'B200', 'A100', 'A6000', 'V100', 'L40', 'RTX 5090', 'RTX 4090', 'RTX 3090', 'RTX 5080', 'RTX 4080'];
const COMPANY_SUFFIXES = ['inc', 'llc', 'corp', 'ltd', 'company', 'technologies', 'solutions', 'services', 'group', 'systems', 'partners', 'global', 'international', 'enterprises'];

function isNewsOutlet(name: string): boolean {
  const lower = name.toLowerCase();
  return NEWS_OUTLETS.some(o => lower.includes(o));
}

function detectGpuModels(text: string): string {
  const upper = text.toUpperCase();
  return GPU_MODELS.filter(m => upper.includes(m)).join(', ') || 'Various';
}

function classifyCompany(text: string): { type: string; priority: 'High' | 'Medium' | 'Low' } {
  const lower = text.toLowerCase();
  if (lower.includes('itad') || lower.includes('asset disposition') || lower.includes('decommission')) return { type: 'ITAD', priority: 'High' };
  if (lower.includes('liquidat') || lower.includes('surplus') || lower.includes('clearance')) return { type: 'Liquidator', priority: 'High' };
  if (lower.includes('auction') || lower.includes('bid')) return { type: 'Auction', priority: 'High' };
  if (lower.includes('wholesale') || lower.includes('bulk') || lower.includes('lot')) return { type: 'Wholesale', priority: 'High' };
  if (lower.includes('refurbish') || lower.includes('renew') || lower.includes('certified')) return { type: 'Refurbisher', priority: 'Medium' };
  if (lower.includes('resell') || lower.includes('distributor') || lower.includes('supplier')) return { type: 'Reseller', priority: 'Medium' };
  if (lower.includes('sell') || lower.includes('offer') || lower.includes('available')) return { type: 'Seller', priority: 'Medium' };
  return { type: 'Seller', priority: 'Low' };
}

function extractCompanyName(title: string, displayLink: string): string {
  // Check for known companies
  for (const company of KNOWN_GPU_COMPANIES) {
    if (title.toLowerCase().includes(company.toLowerCase())) return company;
  }

  // Extract "Company Inc/LLC/Corp" pattern
  const companyPattern = /([A-Z][\w&\s'-]{2,30})\s+(Inc\.?|LLC|Corp\.?|Ltd\.?|Company|Technologies|Solutions|Services|Group|Systems)/gi;
  const match = title.match(companyPattern);
  if (match) return match[0].trim();

  // Use display link domain as company name
  if (displayLink && !isNewsOutlet(displayLink)) {
    const domain = displayLink.replace('www.', '').split('.')[0];
    if (domain.length > 2) return domain.charAt(0).toUpperCase() + domain.slice(1);
  }

  // Extract first capitalized phrase
  const nameMatch = title.match(/^([A-Z][\w\s&'-]{2,30}?)(?:\s*[-–|:]|\s+(?:sell|offer|announ|liquidat|has|is))/i);
  if (nameMatch && !isNewsOutlet(nameMatch[1])) return nameMatch[1].trim();

  return title.split(' - ')[0].split(' | ')[0].trim().slice(0, 50);
}

// ─── Google Custom Search API ────────────────────────────

const SEARCH_QUERIES = [
  // Bulk GPU sales
  'bulk GPU sale NVIDIA RTX',
  'GPU lot wholesale NVIDIA',
  'datacenter GPU liquidation sale',
  'ITAD GPU decommission inventory',
  'enterprise GPU surplus sale USA',
  'GPU server decommission bulk lot',
  'company selling bulk NVIDIA GPU',
  'GPU wholesale distributor USA',
  // Specific models
  'RTX 4090 bulk wholesale company',
  'RTX 5090 bulk lot sale',
  'A100 H100 GPU sale bulk',
  'datacenter GPU A100 liquidation',
  // Auction & liquidation
  'GPU auction lot NVIDIA bulk',
  'GPU liquidation company USA',
  'IT asset disposition GPU wholesale',
  'server GPU pull sale bulk lot',
];

async function searchGoogleCSE(): Promise<CompanyLead[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    console.log('[Google CSE] Skipping — no GOOGLE_API_KEY or GOOGLE_CSE_ID');
    return [];
  }

  const leads: CompanyLead[] = [];

  // Pick 5 queries per run (100 free/day, 10 results each = 10 queries max)
  const now = Date.now();
  const picked = SEARCH_QUERIES
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 41.7) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 5);

  for (const query of picked) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=10&gl=us&lr=lang_en`;
      const res = await fetch(url);

      if (!res.ok) {
        console.error(`[Google CSE] HTTP ${res.status} for "${query}"`);
        continue;
      }

      const data = await res.json();
      const items = data.items || [];

      for (const item of items) {
        const title = item.title || '';
        const snippet = item.snippet || '';
        const link = item.link || '';
        const displayLink = item.displayLink || '';
        const fullText = title + ' ' + snippet;

        // Skip news outlets and big platforms
        if (isNewsOutlet(displayLink) || isNewsOutlet(title)) continue;

        // Must be GPU-related
        // Must be GPU-only — reject laptops, CPUs, etc.
        if (!isGpuOnly(fullText)) continue;

        const company = extractCompanyName(title, displayLink);
        if (isNewsOutlet(company)) continue;

        const { type, priority } = classifyCompany(fullText);

        // Extract location
        let location = 'USA';
        const locMatch = snippet.match(/([\w\s]+,\s*[A-Z]{2})/);
        if (locMatch) location = locMatch[1];

        leads.push({
          company,
          website: link,
          type,
          description: snippet.slice(0, 200),
          location,
          gpuModels: detectGpuModels(fullText),
          priority,
          notes: `Google CSE: "${query}"`,
          foundAt: new Date().toISOString(),
        });
      }

      console.log(`[Google CSE] "${query}" → ${items.length} results, ${leads.length} leads`);
    } catch (err) {
      console.error(`[Google CSE] Error:`, (err as Error).message);
    }
  }

  return leads;
}

// ─── USASpending.gov API — Government GPU contracts ──────

async function searchGovernmentContracts(): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = [];

  try {
    // Search for recent GPU-related government contracts
    const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: {
          keywords: ['GPU NVIDIA'],
          time_period: [{ start_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10) }],
          award_type_codes: ['A', 'B', 'C', 'D'],
        },
        fields: ['Award ID', 'Recipient Name', 'Description', 'Award Amount', 'Awarding Agency'],
        limit: 25,
        order: 'desc',
        sort: 'Award Amount',
        subawards: false,
        page: 1,
      }),
    });

    if (!res.ok) {
      console.error(`[USASpending] HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = data.results || [];

    for (const award of results) {
      const company = award['Recipient Name'] || '';
      const description = award['Description'] || '';
      const amount = award['Award Amount'] || 0;
      const agency = award['Awarding Agency'] || '';

      if (!company) continue;

      const fullText = company + ' ' + description;
      // Must be GPU-related, reject laptops/CPUs
      if (!isGpuOnly(fullText)) continue;

      leads.push({
        company: company.slice(0, 60),
        website: `https://www.usaspending.gov/search/?hash=gpu-${award['Award ID'] || ''}`,
        type: 'Government',
        description: `${description.slice(0, 150)} | Agency: ${agency} | Amount: $${Number(amount).toLocaleString()}`,
        location: 'USA',
        gpuModels: detectGpuModels(description),
        priority: amount > 100000 ? 'High' : 'Medium',
        notes: `USASpending: $${Number(amount).toLocaleString()} contract`,
        foundAt: new Date().toISOString(),
      });
    }

    console.log(`[USASpending] Found ${leads.length} GPU-related contracts`);
  } catch (err) {
    console.error(`[USASpending] Error:`, (err as Error).message);
  }

  return leads;
}


// ─── Reddit — B2B GPU sellers ────────────────────────────

async function searchRedditSellers(): Promise<CompanyLead[]> {
  const leads: CompanyLead[] = [];

  const feeds = [
    'https://www.reddit.com/r/hardwareswap/search.rss?q=selling+GPU+bulk+OR+lot+OR+wholesale&sort=new&t=month',
    'https://www.reddit.com/r/homelabsales/search.rss?q=selling+GPU+OR+NVIDIA+server&sort=new&t=month',
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
      while ((match = entryRegex.exec(xml)) !== null) {
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        const linkMatch = block.match(/<link[^>]*href="([^"]+)"/);
        const authorMatch = block.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/);

        const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').trim() : '';
        const link = linkMatch ? linkMatch[1] : '';
        const author = authorMatch ? authorMatch[1].trim() : '';

        if (!title) continue;
        // Must be GPU-only — reject laptops, CPUs, etc.
        if (!isGpuOnly(title)) continue;

        // Must be selling
        const lower = title.toLowerCase();
        if (!['sell', 'wts', 'fs', 'lot', 'bulk'].some(kw => lower.includes(kw))) continue;

        const company = extractCompanyName(title, '') || `u/${author}`;
        const { type, priority } = classifyCompany(title);

        leads.push({
          company,
          website: link,
          type,
          description: title.slice(0, 200),
          location: 'USA',
          gpuModels: detectGpuModels(title),
          priority: lower.includes('bulk') || lower.includes('lot') ? 'High' : priority,
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

// ─── Main: Find all GPU companies ────────────────────────

export async function findGpuCompanies(): Promise<CompanyLead[]> {
  const [cse, govContracts, reddit] = await Promise.all([
    searchGoogleCSE(),
    searchGovernmentContracts(),
    searchRedditSellers(),
  ]);

  const allLeads = [...cse, ...govContracts, ...reddit];

  console.log(`[Companies] Total: ${allLeads.length} | CSE=${cse.length}, Gov=${govContracts.length}, Reddit=${reddit.length}`);

  // Dedup by company name
  const seen = new Set<string>();
  const deduped = allLeads.filter(l => {
    const key = l.company.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by priority
  const priorityOrder = { High: 3, Medium: 2, Low: 1 };
  deduped.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));

  return deduped;
}
