import { NextResponse } from 'next/server';
import { scrapeNews } from '@/lib/news-scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const news = await scrapeNews();
    return NextResponse.json({
      success: true,
      news,
      scrapedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'News fetch failed: ' + (error as Error).message }, { status: 500 });
  }
}
