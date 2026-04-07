/**
 * Scrapes real GPU news from Google News.
 */

import { getBrowser, closeBrowser } from './browser';

interface NewsItem {
  headline: string;
  source: string;
  link: string;
  time: string;
}

const NEWS_QUERIES = [
  'NVIDIA GPU news',
  'GPU market',
  'NVIDIA earnings GPU',
  'RTX 5090 GPU',
  'RTX 4090 GPU price',
  'AMD Radeon GPU',
  'AI GPU demand',
  'H100 H200 B200 GPU',
  'GPU shortage supply',
  'datacenter GPU',
  'GPU pricing trend',
  'NVIDIA stock GPU',
  'GPU benchmark review',
  'new GPU release',
  'GPU mining crypto',
  'cloud GPU rental',
];

/**
 * Scrape Google News for real GPU/datacenter headlines.
 * Rotates queries each call for variety.
 */
export async function scrapeNews(): Promise<NewsItem[]> {
  const allNews: NewsItem[] = [];

  // Pick 4 random queries this run
  const now = Date.now();
  const shuffled = NEWS_QUERIES
    .map((q, i) => ({ q, sort: Math.sin(now / 1000 + i * 97.3) }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.q)
    .slice(0, 4);

  try {
    const browser = await getBrowser();

    for (const query of shuffled) {
      const page = await browser.newPage();
      try {
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });
        await page.setRequestInterception(true);
        page.on('request', r => {
          if (['image', 'font', 'media', 'stylesheet'].includes(r.resourceType())) r.abort();
          else r.continue();
        });

        const url = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

        try {
          await page.goto(url, { waitUntil: 'load', timeout: 20000 });
        } catch { /* redirect expected */ }

        await new Promise(r => setTimeout(r, 3000));

        const items: NewsItem[] = await page.evaluate(() => {
          const results: { headline: string; source: string; link: string; time: string }[] = [];
          // Google News renders articles in <article> or <a> with data-n-tid
          const articles = document.querySelectorAll('article, [data-n-tid]');

          for (const art of articles) {
            const linkEl = art.querySelector('a[href]');
            const headline = (art as HTMLElement).innerText?.split('\n').filter((l: string) => l.trim().length > 20)?.[0]?.trim();
            if (!headline || !linkEl) continue;

            const allText = (art as HTMLElement).innerText || '';
            const lines = allText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

            // Source is usually a short line (publisher name)
            const source = lines.find((l: string) => l.length > 2 && l.length < 40 && l !== headline) || 'News';
            // Time is usually like "2 hours ago", "1 day ago"
            const time = lines.find((l: string) => l.includes('ago') || l.includes('hour') || l.includes('day') || l.includes('min')) || '';

            const href = (linkEl as HTMLAnchorElement).href;

            if (headline.length > 15 && results.length < 6) {
              results.push({ headline: headline.slice(0, 120), source, link: href, time });
            }
          }
          return results;
        });

        allNews.push(...items);
        await page.close();
      } catch (err) {
        console.error(`[News] Error scraping "${query}":`, (err as Error).message);
        await page.close().catch(() => {});
      }
    }
  } finally {
    await closeBrowser();
  }

  // Deduplicate by headline similarity
  const seen = new Set<string>();
  const deduped = allNews.filter(n => {
    const key = n.headline.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.slice(0, 10);
}

/**
 * Format news items for Discord.
 */
export function formatNewsForDiscord(items: NewsItem[]): string {
  if (!items.length) return 'No GPU news found this cycle.';

  return items.map(n => {
    const time = n.time ? ` · ${n.time}` : '';
    return `**${n.headline}**\n${n.source}${time}`;
  }).join('\n\n');
}
