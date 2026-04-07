import { NextResponse } from 'next/server';
import { scanForDeals } from '@/lib/scraper';
import type { DealScanConfig } from '@/lib/scraper';

export async function POST(request: Request) {
  try {
    const config: Partial<DealScanConfig> = await request.json();
    const result = await scanForDeals(config);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Scan failed: ' + error }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await scanForDeals({ maxPages: 1 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Scan failed: ' + error }, { status: 500 });
  }
}
