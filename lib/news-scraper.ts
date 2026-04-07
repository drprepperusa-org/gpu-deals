/**
 * Scrapes real GPU/AI industry news from Google News.
 * Uses plain fetch + HTML parsing — no Puppeteer needed.
 */

export interface NewsItem {
  headline: string;
  source: string;
  link: string;
  time: string;
}

const NEWS_QUERIES = [
  'GPU price drop',
  'NVIDIA GPU price news',
  'RTX 5090 price',
  'RTX 4090 price drop',
  'AMD Radeon GPU price',
  'GPU market trend',
  'NVIDIA news today',
  'AMD GPU news today',
  'new GPU release 2026',
  'GPU benchmark review',
  'NVIDIA earnings',
  'Intel Arc GPU news',
  'AI GPU demand news',
  'H100 H200 B200 news',
  'datacenter GPU news',
  'cloud GPU pricing',
  'GPU shortage supply chain',
  'GPU stock availability',
  'GPU restock alert',
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
      // Google News RSS — no browser needed
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

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

  // Deduplicate by headline similarity
  const seen = new Set<string>();
  const deduped = allNews.filter(n => {
    const key = n.headline.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

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

    items.push({
      headline: decodeHtmlEntities(title).slice(0, 120),
      source: source || 'News',
      link: link || '',
      time,
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
