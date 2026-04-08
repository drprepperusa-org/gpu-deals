/**
 * Sync findings to Google Sheets using Service Account.
 * Deduplicates before appending — no duplicate rows.
 */

import { SignJWT, importPKCS8 } from 'jose';
import type { GpuListing, CompanyLead, MarketIntel } from './types';

const SHEET_ID = process.env.SHEET_ID || '1PLfPtwdTtCoJCd7gRskIWSl8dhVKs71YcHlLxuPT29Y';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKeyRaw) {
    throw new Error('GOOGLE_SERVICE_EMAIL and GOOGLE_PRIVATE_KEY required for Sheets sync');
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

/**
 * Read existing rows from a sheet range.
 */
async function readSheet(range: string): Promise<string[][]> {
  const accessToken = await getAccessToken();

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.values || [];
}

async function appendToSheet(range: string, values: string[][]) {
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
    throw new Error(`Sheets append failed: ${res.status}`);
  }

  console.log(`[Sheets] Appended ${values.length} rows to ${range}`);
}

/**
 * Sync market intel findings to MARKET_INTEL tab.
 * Deduplicates by link (column C).
 */
export async function syncMarketIntel(intel: MarketIntel[], listings: GpuListing[]) {
  if (!process.env.GOOGLE_SERVICE_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.log('[Sheets] Skipping — no Google credentials');
    return;
  }

  try {
    // Read existing links to avoid duplicates
    const existing = await readSheet('MARKET_INTEL!C:C');
    const existingLinks = new Set(existing.map(row => row[0]?.trim()).filter(Boolean));

    const rows: string[][] = [];

    for (const i of intel) {
      if (i.sourceLink && existingLinks.has(i.sourceLink)) continue;
      rows.push([i.timestamp, i.finding, i.sourceLink]);
      existingLinks.add(i.sourceLink);
    }

    for (const l of listings.slice(0, 5)) {
      if (existingLinks.has(l.link)) continue;
      rows.push([
        new Date().toISOString(),
        `${l.gpuModel} — $${l.pricePerUnit}/unit × ${l.quantity} (${l.condition}) from ${l.source} — ${l.seller}`,
        l.link,
      ]);
      existingLinks.add(l.link);
    }

    if (rows.length > 0) {
      await appendToSheet('MARKET_INTEL!A:C', rows);
    } else {
      console.log('[Sheets] No new market intel to sync (all duplicates)');
    }
  } catch (err) {
    console.error('[Sheets] Market intel sync error:', (err as Error).message);
  }
}

/**
 * Sync company leads to LEADS_TRACKER tab.
 * Deduplicates by website (column J).
 */
export async function syncLeads(leads: CompanyLead[]) {
  if (!process.env.GOOGLE_SERVICE_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.log('[Sheets] Skipping — no Google credentials');
    return;
  }

  if (leads.length === 0) return;

  try {
    // Read existing websites to avoid duplicates
    const existing = await readSheet('LEADS_TRACKER!J:J');
    const existingWebsites = new Set(existing.map(row => row[0]?.trim().toLowerCase()).filter(Boolean));

    const rows = leads
      .filter(l => !existingWebsites.has(l.website.toLowerCase()))
      .map(l => [
        l.company,
        '', // Contact
        '', // Email
        '', // Phone
        l.location,
        l.gpuModels,
        '', // Inventory
        l.priority,
        `${l.type} — ${l.description.slice(0, 100)}`,
        l.website,
        l.foundAt,
      ]);

    if (rows.length > 0) {
      await appendToSheet('LEADS_TRACKER!A:K', rows);
    } else {
      console.log('[Sheets] No new leads to sync (all duplicates)');
    }
  } catch (err) {
    console.error('[Sheets] Leads sync error:', (err as Error).message);
  }
}
