import { NextResponse } from 'next/server';
import { scrapeNews } from '@/lib/news-scraper';
import { DiscordWebhook } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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
    // Scrape real GPU news from Google News
    const newsItems = await scrapeNews();

    // Post to Discord
    let discordStatus: string;
    if (newsItems.length > 0) {
      discordStatus = await discord.sendDailyNews(newsItems);
    } else {
      discordStatus = await discord.sendHeartbeat();
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      newsCount: newsItems.length,
      discordStatus,
      elapsed: `${elapsed}s`,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ success: false, error: 'Cron failed: ' + (error as Error).message }, { status: 500 });
  }
}
