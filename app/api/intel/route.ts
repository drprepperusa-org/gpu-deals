import { NextResponse } from 'next/server';
import { scrapeLeads } from '@/lib/market-intel';
import { scanForDeals } from '@/lib/scraper';
import { generateMarketSummary } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leads = await scrapeLeads();
    const { listings, totalScanned } = await scanForDeals({ maxPages: 1 });
    const aiAnalysis = listings.length > 0 ? generateMarketSummary({ listings, priceDrops: [], news: [], totalScanned }) : '';

    return NextResponse.json({
      success: true,
      leads,
      listings,
      totalScanned,
      aiAnalysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Intel failed: ' + (error as Error).message }, { status: 500 });
  }
}
