/**
 * Sync findings to Google Sheets using Service Account.
 * Uses JWT to authenticate — no OAuth flow needed, never expires.
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

  // Parse the private key (handle escaped newlines from env)
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);

  // Create JWT
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

  // Exchange JWT for access token
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
 */
export async function syncMarketIntel(intel: MarketIntel[], listings: GpuListing[]) {
  if (!process.env.GOOGLE_SERVICE_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.log('[Sheets] Skipping — no Google credentials');
    return;
  }

  try {
    const rows: string[][] = [];

    // Intel rows
    for (const i of intel) {
      rows.push([i.timestamp, i.finding, i.sourceLink]);
    }

    // Top listings as intel
    for (const l of listings.slice(0, 5)) {
      rows.push([
        new Date().toISOString(),
        `${l.gpuModel} — $${l.pricePerUnit}/unit × ${l.quantity} (${l.condition}) from ${l.source} — ${l.seller}`,
        l.link,
      ]);
    }

    if (rows.length > 0) {
      await appendToSheet('MARKET_INTEL!A:C', rows);
    }
  } catch (err) {
    console.error('[Sheets] Market intel sync error:', (err as Error).message);
  }
}

/**
 * Sync company leads to LEADS_TRACKER tab.
 */
export async function syncLeads(leads: CompanyLead[]) {
  if (!process.env.GOOGLE_SERVICE_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.log('[Sheets] Skipping — no Google credentials');
    return;
  }

  if (leads.length === 0) return;

  try {
    const rows = leads.map(l => [
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

    await appendToSheet('LEADS_TRACKER!A:K', rows);
  } catch (err) {
    console.error('[Sheets] Leads sync error:', (err as Error).message);
  }
}
