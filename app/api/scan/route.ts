import { NextResponse } from 'next/server';
import { scanForGpuDeals } from '@/lib/gpu-scraper';
import { findGpuCompanies } from '@/lib/lead-finder';
import { generateIntel, getActionItem } from '@/lib/intel';
import { syncMarketIntel, syncLeads } from '@/lib/sheets';
import { saveListings, saveLeads } from '@/lib/store';
import { evaluateAlerts, saveAlerts, sendAlertToDiscord } from '@/lib/alerts';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Manual scan endpoint — runs from localhost.
 * Scrapes, saves to Supabase, syncs to Sheets.
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || 'today';

  try {
    const [dealResults, leads] = await Promise.all([
      scanForGpuDeals(range),
      findGpuCompanies(),
    ]);

    const { listings, totalScanned, sources } = dealResults;
    const intel = generateIntel({ listings, leads });
    const actionItem = getActionItem(listings, leads);

    // Save to Supabase (so Vercel dashboard can read it)
    try {
      await Promise.all([
        saveListings(listings),
        saveLeads(leads),
      ]);
    } catch (err) {
      console.error('[Store] Save error:', (err as Error).message);
    }

    // Evaluate alert rules
    const alerts = evaluateAlerts(listings, leads);
    let alertCount = 0;
    if (alerts.length > 0) {
      alertCount = await saveAlerts(alerts) || 0;
      await sendAlertToDiscord(alerts);
    }

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
      alerts: alertCount,
      elapsed: `${elapsed}s`,
    });
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ success: false, error: 'Scan failed: ' + (error as Error).message }, { status: 500 });
  }
}
