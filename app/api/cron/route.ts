import { NextResponse } from 'next/server';
import { scanForDeals } from '@/lib/scraper';
import { analyzeNewListings } from '@/lib/gemini';
import { scrapeNews, formatNewsForDiscord } from '@/lib/news-scraper';
import { DiscordWebhook } from '@/lib/discord';
import { hasBeenPosted, markPosted, purgeExpired, saveListings } from '@/lib/dedup';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Track daily news (in-memory is fine — resets on cold start, sends news again)
let lastNewsDate = '';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const discord = new DiscordWebhook();

  if (!discord.isConfigured()) {
    return NextResponse.json({ success: false, error: 'DISCORD_WEBHOOK_URL not set' }, { status: 500 });
  }

  try {
    await purgeExpired();

    // 1. Scan for GPU deals
    const { listings, totalScanned, queriesUsed } = await scanForDeals({ maxPages: 2 });

    // 2. Filter to NEW only (check Supabase)
    const newLinks: string[] = [];
    const newListings = [];
    for (const l of listings) {
      if (!(await hasBeenPosted(l.link))) {
        newListings.push(l);
        newLinks.push(l.link);
      }
    }

    // Mark as posted + save to DB
    if (newLinks.length > 0) {
      await markPosted(newLinks);
      await saveListings(newListings);
    }

    // 3. Real news — once per day
    const todayStr = new Date().toISOString().slice(0, 10);
    let newsStatus = 'skipped';
    if (todayStr !== lastNewsDate) {
      try {
        const newsItems = await scrapeNews();
        if (newsItems.length > 0) {
          const newsDigest = formatNewsForDiscord(newsItems);
          newsStatus = await discord.sendNewsDigest(newsDigest);
          if (newsStatus === 'sent') lastNewsDate = todayStr;
        }
      } catch (err) {
        console.error('[News] Error:', (err as Error).message);
        newsStatus = 'error';
      }
    }

    // 4. Post deals to Discord
    let discordStatus = 'no-new';
    if (newListings.length > 0) {
      const analysis = analyzeNewListings(newListings);
      discordStatus = await discord.sendDrop({
        newListings,
        totalThisScan: listings.length,
        totalScanned,
        aiAnalysis: analysis,
        queriesUsed,
      });
    } else {
      discordStatus = await discord.sendHeartbeat(totalScanned, queriesUsed.length);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      total: listings.length,
      new: newListings.length,
      scanned: totalScanned,
      discordStatus,
      newsStatus,
      elapsed: `${elapsed}s`,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ success: false, error: 'Cron failed: ' + (error as Error).message }, { status: 500 });
  }
}
