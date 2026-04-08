/**
 * Store and retrieve GPU scan results from Supabase.
 * Local machine writes, Vercel dashboard reads.
 */

import { getSupabase } from './supabase';
import type { GpuListing, CompanyLead } from './types';

/**
 * Save GPU listings to Supabase (dedup by link).
 */
export async function saveListings(listings: GpuListing[]) {
  if (!listings.length) return;
  const sb = getSupabase();

  const rows = listings.map(l => ({
    title: l.title,
    price: l.price,
    price_per_unit: l.pricePerUnit,
    quantity: l.quantity,
    gpu_model: l.gpuModel,
    condition: l.condition,
    seller: l.seller,
    link: l.link,
    source: l.source,
    score: l.score,
    found_at: l.foundAt,
  }));

  const { error } = await sb.from('gpu_listings').upsert(rows, { onConflict: 'link' });
  if (error) console.error('[Store] Save listings error:', error.message);
  else console.log(`[Store] Saved ${rows.length} listings to Supabase`);
}

/**
 * Save company leads to Supabase (dedup by website).
 */
export async function saveLeads(leads: CompanyLead[]) {
  if (!leads.length) return;
  const sb = getSupabase();

  const rows = leads.map(l => ({
    company: l.company,
    website: l.website,
    type: l.type,
    description: l.description,
    location: l.location,
    gpu_models: l.gpuModels,
    priority: l.priority,
    notes: l.notes,
    found_at: l.foundAt,
  }));

  const { error } = await sb.from('gpu_leads').upsert(rows, { onConflict: 'website' });
  if (error) console.error('[Store] Save leads error:', error.message);
  else console.log(`[Store] Saved ${rows.length} leads to Supabase`);
}

/**
 * Get recent GPU listings from Supabase.
 */
export async function getListings(days: number = 7): Promise<GpuListing[]> {
  const sb = getSupabase();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('gpu_listings')
    .select('*')
    .gt('found_at', since)
    .order('score', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[Store] Get listings error:', error.message);
    return [];
  }

  return (data || []).map(row => ({
    title: row.title,
    price: Number(row.price),
    pricePerUnit: Number(row.price_per_unit),
    quantity: row.quantity,
    gpuModel: row.gpu_model,
    condition: row.condition,
    seller: row.seller,
    link: row.link,
    source: row.source,
    score: row.score,
    foundAt: row.found_at,
  }));
}

/**
 * Get company leads from Supabase.
 */
export async function getLeads(): Promise<CompanyLead[]> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from('gpu_leads')
    .select('*')
    .order('found_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Store] Get leads error:', error.message);
    return [];
  }

  return (data || []).map(row => ({
    company: row.company,
    website: row.website,
    type: row.type,
    description: row.description,
    location: row.location,
    gpuModels: row.gpu_models,
    priority: row.priority,
    notes: row.notes,
    foundAt: row.found_at,
  }));
}
