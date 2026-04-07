/**
 * Scrapes real GPU/AI industry news from Google News.
 * Uses plain fetch + HTML parsing — no Puppeteer needed.
 */

export interface NewsItem {
  headline: string;
  source: string;
  link: string;
  time: string;
  publishedAt: number; // timestamp for sorting
}

const NEWS_QUERIES = [
  'GPU price',
  'NVIDIA GPU',
  'RTX 5090',
  'RTX 4090',
  'AMD Radeon GPU',
  'GPU market',
  'NVIDIA',
  'AMD GPU',
  'GPU release',
  'GPU review',
  'NVIDIA earnings',
  'Intel Arc GPU',
  'AI GPU',
  'H100 H200 B200',
  'datacenter GPU',
  'cloud GPU',
  'GPU shortage',
  'GPU stock',
  'GPU deal',
];

/**
 * Scrape Google News RSS for real GPU headlines.
 * Google News RSS feeds don't need a browser — just fetch XML.
 */
export async function scrapeNews(): Promise<NewsItem[]> {
  const allNews: NewsItem[] = [];

  // Pick 5 random queries this run
  const now = Date.now();
  const shuffled = NEWS_QUERIES
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 97.3) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 5);

  for (const query of shuffled) {
    try {
      // Google News RSS — filter to last 24h with "when:1d"
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:1d')}&hl=en-US&gl=US&ceid=US:en`;

      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) {
        console.error(`[News] HTTP ${res.status} for "${query}"`);
        continue;
      }

      const xml = await res.text();

      // Parse RSS XML items
      const items = parseRssItems(xml);
      allNews.push(...items);
    } catch (err) {
      console.error(`[News] Error fetching "${query}":`, (err as Error).message);
    }
  }

  // Filter out articles older than 48 hours
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = allNews.filter(n => n.publishedAt === 0 || n.publishedAt > cutoff);

  // Deduplicate by headline similarity
  const seen = new Set<string>();
  const deduped = recent.filter(n => {
    const key = n.headline.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort newest first
  deduped.sort((a, b) => b.publishedAt - a.publishedAt);

  return deduped.slice(0, 15);
}

/**
 * Parse Google News RSS XML into NewsItem array.
 */
function parseRssItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];

  // Match each <item>...</item> block
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractTag(block, 'source');

    if (!title || title.length < 15) continue;

    // Convert pubDate to relative time
    const time = pubDate ? getRelativeTime(pubDate) : '';

    const publishedAt = pubDate ? new Date(pubDate).getTime() : 0;

    items.push({
      headline: decodeHtmlEntities(title).slice(0, 120),
      source: source || 'News',
      link: link || '',
      time,
      publishedAt,
    });

    if (items.length >= 6) break;
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA: <tag><![CDATA[content]]></tag>
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular: <tag>content</tag>
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  if (match) return match[1].trim();

  // Handle self-closing or content after tag on same line
  const lineRegex = new RegExp(`<${tag}[^>]*>\\s*([^<]+)`);
  const lineMatch = xml.match(lineRegex);
  if (lineMatch) return lineMatch[1].trim();

  return '';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function getRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
