import { NextResponse } from 'next/server';
import { scanForGpuDeals } from '@/lib/gpu-scraper';
import { findGpuCompanies } from '@/lib/lead-finder';
import { generateIntel, getActionItem } from '@/lib/intel';
import { syncMarketIntel, syncLeads } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Manual scan endpoint — protected by JWT auth via proxy.
 * Used by the dashboard "Scan for GPU Deals" button.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    const [dealResults, leads] = await Promise.all([
      scanForGpuDeals(),
      findGpuCompanies(),
    ]);

    const { listings, totalScanned, sources } = dealResults;
    const intel = generateIntel({ listings, leads });
    const actionItem = getActionItem(listings, leads);

    // Sync to Google Sheet
    try {
      await Promise.all([
        syncMarketIntel(intel, listings),
        syncLeads(leads),
      ]);
    } catch (err) {
      console.error('[Sheets] Sync error:', (err as Error).message);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      listings: listings.length,
      listingsData: listings,
      leads: leads.length,
      leadsData: leads,
      intelItems: intel.length,
      actionItem,
      scanned: totalScanned,
      sources,
      elapsed: `${elapsed}s`,
    });
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ success: false, error: 'Scan failed: ' + (error as Error).message }, { status: 500 });
  }
}
