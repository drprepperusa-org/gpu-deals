#!/usr/bin/env node

/**
 * OpenClaw GPU Scanner — 2-Minute Runner
 *
 * Hits /api/cron every 2 minutes to:
 *   1. Scrape eBay for datacenter GPU decommission deals
 *   2. Dedup — only post NEW listings to Discord
 *   3. AI analysis via Gemini on new finds
 *   4. Daily news digest (once per day)
 *
 * Usage:
 *   npm run dev    (terminal 1)
 *   npm run runner (terminal 2)
 */

const INTERVAL_MS = 2 * 60 * 1000;
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CRON_SECRET = process.env.CRON_SECRET || '';

async function run() {
  const ts = new Date().toLocaleTimeString();
  process.stdout.write(`[${ts}] Scanning... `);

  try {
    const url = `${BASE_URL}/api/cron${CRON_SECRET ? `?secret=${CRON_SECRET}` : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
    const d = await res.json();

    if (d.success) {
      if (d.new > 0) {
        console.log(`✅ ${d.new} NEW listings (${d.total} total, ${d.scanned} scanned) [${d.elapsed}]`);
      } else {
        console.log(`— no new leads (${d.total} total, ${d.scanned} scanned, ${d.cached} cached) [${d.elapsed}]`);
      }
    } else {
      console.log(`❌ ${d.error}`);
    }
  } catch (err) {
    console.log(`❌ ${err.message}`);
  }
}

console.log('══════════════════════════════════════');
console.log('  OpenClaw GPU Scanner v1.0');
console.log('  Scanning every 2 min for DC deals');
console.log(`  Target: ${BASE_URL}/api/cron`);
console.log('══════════════════════════════════════');

run();
setInterval(run, INTERVAL_MS);
