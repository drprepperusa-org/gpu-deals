/**
 * Google Sheets sync with 3-tab workflow:
 *   REVIEW_QUEUE — all new listings land here for review
 *   APPROVED     — confirmed good leads (moved manually or via API)
 *   REJECTED     — junk/false positives
 *
 * Also keeps MARKET_INTEL and LEADS_TRACKER for backward compat.
 * Deduplicates before appending.
 */

import { SignJWT, importPKCS8 } from 'jose';
import type { GpuListing, CompanyLead, MarketIntel } from './types';
import type { Alert } from './alerts';

const SHEET_ID = process.env.SHEET_ID || '1PLfPtwdTtCoJCd7gRskIWSl8dhVKs71YcHlLxuPT29Y';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// ─── Auth ────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKeyRaw) {
    throw new Error('GOOGLE_SERVICE_EMAIL and GOOGLE_PRIVATE_KEY required');
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);

  const key = await importPKCS8(privateKey, 'RS256');
  const jwt = await new SignJWT({
    iss: email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(key);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ─── Sheet helpers ───────────────────────────────────────

async function readColumn(range: string): Promise<Set<string>> {
  const accessToken = await getAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  if (!res.ok) return new Set();
  const data = await res.json();
  return new Set((data.values || []).map((row: string[]) => row[0]?.trim()).filter(Boolean));
}

async function appendRows(range: string, values: string[][]) {
  if (!values.length) return;
  const accessToken = await getAccessToken();

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[Sheets] Append error for ${range}:`, err);
    return;
  }

  console.log(`[Sheets] Appended ${values.length} rows to ${range}`);
}

// ─── Ensure headers exist ────────────────────────────────

async function ensureHeaders() {
  const accessToken = await getAccessToken();

  const headers: Record<string, string[][]> = {
    'REVIEW_QUEUE!A1:J1': [['Date', 'GPU Model', 'Title', 'Price', 'Qty', 'Per Unit', 'Condition', 'Seller', 'Source', 'Link']],
    'APPROVED!A1:J1': [['Date', 'GPU Model', 'Title', 'Price', 'Qty', 'Per Unit', 'Condition', 'Seller', 'Source', 'Link']],
    'REJECTED!A1:J1': [['Date', 'GPU Model', 'Title', 'Price', 'Qty', 'Per Unit', 'Condition', 'Seller', 'Source', 'Link']],
    'MARKET_INTEL!A1:C1': [['Timestamp', 'Finding', 'Link']],
    'LEADS_TRACKER!A1:K1': [['Company', 'Contact', 'Email', 'Phone', 'Location', 'GPU Models', 'Inventory', 'Priority', 'Type & Description', 'Website', 'Found At']],
    'ALERTS!A1:F1': [['Date', 'Priority', 'Type', 'Title', 'Message', 'Link']],
  };

  for (const [range, values] of Object.entries(headers)) {
    try {
      // Check if header row exists
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      if (!data.values || data.values.length === 0) {
        await appendRows(range.split('!')[0] + '!A:Z', values);
      }
    } catch {
      // Tab might not exist yet — skip
    }
  }
}

// ─── REVIEW_QUEUE: All new listings ──────────────────────

export async function syncReviewQueue(listings: GpuListing[]) {
  if (!process.env.GOOGLE_SERVICE_EMAIL || !listings.length) return;

  try {
    await ensureHeaders();

    // Dedup by link (column J)
    const existing = await readColumn('REVIEW_QUEUE!J:J');

    const rows = listings
      .filter(l => !existing.has(l.link))
      .map(l => [
        new Date(l.foundAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
        l.gpuModel,
        l.title.slice(0, 100),
        l.price > 0 ? `$${l.price.toLocaleString()}` : '',
        String(l.quantity),
        l.pricePerUnit > 0 ? `$${l.pricePerUnit.toLocaleString()}` : '',
        l.condition,
        l.seller,
        l.source,
        l.link,
      ]);

    if (rows.length > 0) {
      await appendRows('REVIEW_QUEUE!A:J', rows);
      console.log(`[Sheets] ${rows.length} listings → REVIEW_QUEUE`);
    } else {
      console.log('[Sheets] No new listings for REVIEW_QUEUE');
    }
  } catch (err) {
    console.error('[Sheets] Review queue error:', (err as Error).message);
  }
}

// ─── ALERTS tab ──────────────────────────────────────────

export async function syncAlerts(alerts: Alert[]) {
  if (!process.env.GOOGLE_SERVICE_EMAIL || !alerts.length) return;

  try {
    // Dedup by link (column F)
    const existing = await readColumn('ALERTS!F:F');

    const rows = alerts
      .filter(a => !existing.has(a.link))
      .map(a => [
        new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
        a.priority.toUpperCase(),
        a.type,
        a.title,
        a.message,
        a.link,
      ]);

    if (rows.length > 0) {
      await appendRows('ALERTS!A:F', rows);
      console.log(`[Sheets] ${rows.length} alerts → ALERTS`);
    }
  } catch (err) {
    console.error('[Sheets] Alerts sync error:', (err as Error).message);
  }
}

// ─── MARKET_INTEL tab ────────────────────────────────────

export async function syncMarketIntel(intel: MarketIntel[], listings: GpuListing[]) {
  if (!process.env.GOOGLE_SERVICE_EMAIL) return;

  try {
    const existing = await readColumn('MARKET_INTEL!C:C');
    const rows: string[][] = [];

    for (const i of intel) {
      if (i.sourceLink && existing.has(i.sourceLink)) continue;
      rows.push([i.timestamp, i.finding, i.sourceLink]);
      existing.add(i.sourceLink);
    }

    for (const l of listings.slice(0, 5)) {
      if (existing.has(l.link)) continue;
      rows.push([
        new Date().toISOString(),
        `${l.gpuModel} — $${l.pricePerUnit}/unit × ${l.quantity} (${l.condition}) from ${l.source} — ${l.seller}`,
        l.link,
      ]);
      existing.add(l.link);
    }

    if (rows.length > 0) await appendRows('MARKET_INTEL!A:C', rows);
    else console.log('[Sheets] No new market intel');
  } catch (err) {
    console.error('[Sheets] Market intel error:', (err as Error).message);
  }
}

// ─── LEADS_TRACKER tab ──────────────────────────────────

export async function syncLeads(leads: CompanyLead[]) {
  if (!process.env.GOOGLE_SERVICE_EMAIL || !leads.length) return;

  try {
    const existing = await readColumn('LEADS_TRACKER!J:J');

    const rows = leads
      .filter(l => !existing.has(l.website.toLowerCase()))
      .map(l => [
        l.company,
        '', '', '', // Contact, Email, Phone
        l.location,
        l.gpuModels,
        '', // Inventory
        l.priority,
        `${l.type} — ${l.description.slice(0, 100)}`,
        l.website,
        l.foundAt,
      ]);

    if (rows.length > 0) await appendRows('LEADS_TRACKER!A:K', rows);
    else console.log('[Sheets] No new leads');
  } catch (err) {
    console.error('[Sheets] Leads error:', (err as Error).message);
  }
}
