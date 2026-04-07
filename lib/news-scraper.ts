/**
 * Scrapes real GPU/AI industry news from Google News.
 * This is the primary data source — all content is live, nothing static.
 */

import { getBrowser, closeBrowser } from './browser';

export interface NewsItem {
  headline: string;
  source: string;
  link: string;
  time: string;
}

const NEWS_QUERIES = [
  // GPU pricing & market
  'GPU price drop 2026',
  'NVIDIA GPU price news',
  'RTX 5090 price',
  'RTX 4090 price drop',
  'AMD Radeon GPU price',
  'GPU market trend',

  // Industry & launches
  'NVIDIA news today',
  'AMD GPU news today',
  'new GPU release 2026',
  'GPU benchmark review',
  'NVIDIA earnings',
  'Intel Arc GPU news',

  // AI & datacenter
  'AI GPU demand news',
  'H100 H200 B200 news',
  'datacenter GPU news',
  'cloud GPU pricing',

  // Supply & crypto
  'GPU shortage supply chain',
  'GPU stock availability',
  'GPU mining crypto news',
  'GPU restock alert',
];

/**
 * Scrape Google News for real GPU headlines.
 * Rotates 5 queries per run for variety.
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
          const articles = document.querySelectorAll('article, [data-n-tid]');

          for (const art of articles) {
            const linkEl = art.querySelector('a[href]');
            const headline = (art as HTMLElement).innerText?.split('\n').filter((l: string) => l.trim().length > 20)?.[0]?.trim();
            if (!headline || !linkEl) continue;

            const allText = (art as HTMLElement).innerText || '';
            const lines = allText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

            const source = lines.find((l: string) => l.length > 2 && l.length < 40 && l !== headline) || 'News';
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

  return deduped.slice(0, 15);
}
