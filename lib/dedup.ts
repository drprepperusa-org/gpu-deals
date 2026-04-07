import { getSupabase } from './supabase';

export async function hasBeenPosted(link: string): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb
    .from('dedup_cache')
    .select('link')
    .eq('link', link)
    .gt('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();
  return !!data;
}

export async function markPosted(links: string[]) {
  if (!links.length) return;
  const sb = getSupabase();
  const rows = links.map(link => ({ link, posted_at: new Date().toISOString() }));
  await sb.from('dedup_cache').upsert(rows, { onConflict: 'link' });
}

export async function purgeExpired() {
  const sb = getSupabase();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await sb.from('dedup_cache').delete().lt('posted_at', cutoff);
}

export async function saveListings(listings: { id: string; title: string; price: number; pricePerUnit: number; quantity: number; gpuModel: string; source: string; seller: string; condition: string; link: string }[]) {
  if (!listings.length) return;
  const sb = getSupabase();
  const rows = listings.map(l => ({
    id: l.id,
    title: l.title,
    price: l.price,
    price_per_unit: l.pricePerUnit,
    quantity: l.quantity,
    gpu_model: l.gpuModel,
    source: l.source,
    seller: l.seller,
    condition: l.condition,
    link: l.link,
    found_at: new Date().toISOString(),
  }));
  const { error } = await sb.from('listings').upsert(rows, { onConflict: 'link' });
  if (error) console.error('Save listings error:', error);
}
