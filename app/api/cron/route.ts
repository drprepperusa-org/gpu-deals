import { NextResponse } from 'next/server';
import { scanForGpuDeals } from '@/lib/gpu-scraper';
import { findGpuCompanies } from '@/lib/company-scanner';
import { DiscordWebhook } from '@/lib/discord';
import { generateIntel, getActionItem } from '@/lib/intel';
import { syncMarketIntel, syncLeads, syncReviewQueue, syncAlerts } from '@/lib/sheets';
import { saveListings, saveLeads } from '@/lib/store';
import { evaluateAlerts, saveAlerts, sendAlertToDiscord } from '@/lib/alerts';
import { getDiscordEnabled } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  // Check if Discord is paused
  let discordPaused = false;
  try {
    const enabled = await getDiscordEnabled();
    if (!enabled) discordPaused = true;
  } catch { /* default to sending */ }

  if (discordPaused) {
    return NextResponse.json({ success: true, discordStatus: 'paused', elapsed: '0s' });
  }

  const discord = new DiscordWebhook();
  if (!discord.isConfigured()) {
    return NextResponse.json({ success: false, error: 'DISCORD_WEBHOOK_URL not set' }, { status: 500 });
  }

  try {
    // Run scrapers in parallel
    const [dealResults, leads] = await Promise.all([
      scanForGpuDeals(),
      findGpuCompanies(),
    ]);

    const { listings, totalScanned, sources } = dealResults;

    // Generate intelligence analysis
    const intel = generateIntel({ listings, leads });
    const actionItem = getActionItem(listings, leads);

    // Post to Discord
    let discordStatus: string;
    if (listings.length > 0 || leads.length > 0) {
      discordStatus = await discord.sendIntelDrop({
        listings,
        leads,
        totalScanned,
        sources,
      });
    } else {
      discordStatus = await discord.sendHeartbeat();
    }

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

    // Sync to Google Sheets (all tabs)
    try {
      await Promise.all([
        syncReviewQueue(listings),
        syncAlerts(alerts),
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
      leads: leads.length,
      intelItems: intel.length,
      scanned: totalScanned,
      sources,
      alerts: alertCount,
      discordStatus,
      elapsed: `${elapsed}s`,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ success: false, error: 'Cron failed: ' + (error as Error).message }, { status: 500 });
  }
}
