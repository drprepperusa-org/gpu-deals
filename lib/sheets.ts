/**
 * Sync findings to Google Sheets.
 * Uses OAuth2 refresh token to get access token, then appends rows.
 */

import type { GpuListing, CompanyLead, MarketIntel } from './types';

const SHEET_ID = process.env.SHEET_ID || '1PLfPtwdTtCoJCd7gRskIWSl8dhVKs71YcHlLxuPT29Y';

interface GoogleToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

interface GoogleCredentials {
  installed: {
    client_id: string;
    client_secret: string;
    token_uri: string;
  };
}

async function getAccessToken(): Promise<string> {
  const credsRaw = process.env.GOOGLE_CREDENTIALS;
  const tokenRaw = process.env.GOOGLE_TOKEN;

  if (!credsRaw || !tokenRaw) {
    throw new Error('GOOGLE_CREDENTIALS and GOOGLE_TOKEN required for Sheets sync');
  }

  const creds: GoogleCredentials = JSON.parse(credsRaw);
  const token: GoogleToken = JSON.parse(tokenRaw);

  // If token is still valid, use it
  if (token.expiry_date && token.expiry_date > Date.now() + 60000) {
    return token.access_token;
  }

  // Refresh the token
  const res = await fetch(creds.installed.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.installed.client_id,
      client_secret: creds.installed.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
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
  }
}

/**
 * Sync market intel findings to MARKET_INTEL tab.
 */
export async function syncMarketIntel(intel: MarketIntel[], listings: GpuListing[]) {
  if (!process.env.GOOGLE_CREDENTIALS || !process.env.GOOGLE_TOKEN) {
    console.log('[Sheets] Skipping — no Google credentials');
    return;
  }

  try {
    // Market intel rows
    if (intel.length > 0) {
      const rows = intel.map(i => [i.timestamp, i.finding, i.sourceLink]);
      await appendToSheet('MARKET_INTEL!A:C', rows);
      console.log(`[Sheets] Synced ${rows.length} market intel rows`);
    }

    // Top listings as intel
    if (listings.length > 0) {
      const topListings = listings.slice(0, 5);
      const rows = topListings.map(l => [
        new Date().toISOString(),
        `${l.gpuModel} — $${l.pricePerUnit}/unit × ${l.quantity} (${l.condition}) from ${l.source}`,
        l.link,
      ]);
      await appendToSheet('MARKET_INTEL!A:C', rows);
      console.log(`[Sheets] Synced ${rows.length} listing intel rows`);
    }
  } catch (err) {
    console.error('[Sheets] Market intel sync error:', (err as Error).message);
  }
}

/**
 * Sync company leads to LEADS_TRACKER tab.
 */
export async function syncLeads(leads: CompanyLead[]) {
  if (!process.env.GOOGLE_CREDENTIALS || !process.env.GOOGLE_TOKEN) {
    console.log('[Sheets] Skipping — no Google credentials');
    return;
  }

  if (leads.length === 0) return;

  try {
    const rows = leads.map(l => [
      l.company,
      '', // Contact person — unknown from scraping
      '', // Email — unknown
      '', // Phone — unknown
      l.location,
      l.gpuModels,
      '', // Inventory estimate
      l.priority,
      `${l.type} — ${l.description.slice(0, 100)}`,
      l.website,
      l.foundAt,
    ]);

    await appendToSheet('LEADS_TRACKER!A:K', rows);
    console.log(`[Sheets] Synced ${rows.length} leads`);
  } catch (err) {
    console.error('[Sheets] Leads sync error:', (err as Error).message);
  }
}
