import { NextResponse } from 'next/server';
import { getAllKnownCompanies } from '@/lib/known-companies';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Seed the database with DJ's curated GPU company list.
 * Run once: /api/seed?secret=CRON_SECRET
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const companies = getAllKnownCompanies();
  const sb = getSupabase();

  let saved = 0;
  for (const c of companies) {
    const { error } = await sb.from('gpu_leads').upsert({
      company: c.company,
      website: c.website,
      type: c.category,
      description: c.whyTheyHaveGpus,
      location: c.location,
      gpu_models: c.gpuModels,
      priority: c.priority === 'HIGH' ? 'High' : c.priority === 'MEDIUM' ? 'Medium' : 'Low',
      notes: `${c.contactApproach} | Key: ${c.keyPerson} | ${c.phone} | ${c.email}`,
      found_at: new Date().toISOString(),
    }, { onConflict: 'website' });

    if (!error) saved++;
  }

  return NextResponse.json({ success: true, seeded: saved, total: companies.length });
}
