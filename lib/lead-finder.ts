/**
 * Finds companies selling GPUs — ITAD, liquidators, auction houses, resellers.
 * Uses Google search RSS to find real companies.
 */

import type { CompanyLead } from './types';

const LEAD_QUERIES = [
  'ITAD GPU liquidation company site:.com',
  'datacenter GPU decommission services',
  'bulk GPU liquidation service USA',
  'enterprise GPU buyback company',
  'data center equipment liquidator GPU',
  'GPU server decommission ITAD wholesale',
  'datacenter hardware reseller GPU bulk',
  'IT asset disposition GPU servers',
  'GPU auction house bulk lots',
  'refurbished enterprise GPU wholesale',
];

function pickQueries(count: number = 3): string[] {
  const now = Date.now();
  return LEAD_QUERIES
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 71.3) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, count);
}

/**
 * Search Google for companies selling GPUs via RSS.
 */
export async function findGpuCompanies(): Promise<CompanyLead[]> {
  const queries = pickQueries(3);
  const allLeads: CompanyLead[] = [];

  for (const query of queries) {
    try {
      // Use Google search with fetch
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=8`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!res.ok) {
        console.error(`[Leads] HTTP ${res.status} for "${query}"`);
        continue;
      }

      const html = await res.text();

      // Parse search results with regex (no cheerio needed for Google)
      const results = parseGoogleResults(html);

      for (const r of results) {
        let website = '';
        try { website = new URL(r.link).hostname.replace('www.', ''); } catch { continue; }

        // Skip big platforms
        if (['google.com', 'youtube.com', 'wikipedia.org', 'reddit.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'amazon.com', 'ebay.com'].some(d => website.includes(d))) continue;

        const text = (r.title + ' ' + r.snippet).toLowerCase();

        // Determine company type
        let type = 'Reseller';
        if (text.includes('itad') || text.includes('asset disposition') || text.includes('decommission')) type = 'ITAD';
        else if (text.includes('liquidat')) type = 'Liquidator';
        else if (text.includes('auction')) type = 'Auction';
        else if (text.includes('recycl') || text.includes('e-waste')) type = 'ITAD';
        else if (text.includes('wholesale') || text.includes('bulk')) type = 'Reseller';

        // Determine GPU models mentioned
        const gpuModels: string[] = [];
        const upper = text.toUpperCase();
        for (const m of ['H100', 'A100', 'RTX 4090', 'RTX 5090', 'RTX 3090', 'A6000', 'V100', 'L40']) {
          if (upper.includes(m)) gpuModels.push(m);
        }

        // Extract location
        let location = 'USA';
        const locMatch = r.snippet.match(/([\w\s]+,\s*[A-Z]{2})/);
        if (locMatch) location = locMatch[1];

        // Determine priority
        let priority: 'High' | 'Medium' | 'Low' = 'Medium';
        if (type === 'ITAD' || type === 'Liquidator') priority = 'High';
        if (gpuModels.length >= 2) priority = 'High';
        if (text.includes('bulk') && text.includes('gpu')) priority = 'High';

        allLeads.push({
          company: r.title.split(' - ')[0].split(' | ')[0].trim().slice(0, 60),
          website,
          type,
          description: r.snippet.slice(0, 200) || r.title,
          location,
          gpuModels: gpuModels.join(', ') || 'Various',
          priority,
          notes: `Found via: "${query}"`,
          foundAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[Leads] Error searching "${query}":`, (err as Error).message);
    }
  }

  // Dedup by website
  const seen = new Set<string>();
  return allLeads.filter(l => {
    if (seen.has(l.website)) return false;
    seen.add(l.website);
    return true;
  });
}

function parseGoogleResults(html: string): { title: string; link: string; snippet: string }[] {
  const results: { title: string; link: string; snippet: string }[] = [];

  // Extract URLs and titles from Google search HTML
  const linkRegex = /<a[^>]*href="\/url\?q=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = linkRegex.exec(html)) !== null && results.length < 6) {
    const link = decodeURIComponent(match[1]);
    const titleHtml = match[2];
    const title = titleHtml.replace(/<[^>]+>/g, '').trim();

    if (!link.startsWith('http') || title.length < 5) continue;

    // Find nearby snippet text
    const snippetStart = html.indexOf(match[0]) + match[0].length;
    const snippetChunk = html.slice(snippetStart, snippetStart + 500);
    const snippetText = snippetChunk.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);

    results.push({ title, link, snippet: snippetText });
  }

  return results;
}
