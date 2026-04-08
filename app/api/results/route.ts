import { NextResponse } from 'next/server';
import { getListings, getLeads } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * Read scan results from Supabase.
 * Used by the Vercel dashboard to display results
 * that were saved by the local scanner.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '7');

  try {
    const [listings, leads] = await Promise.all([
      getListings(days),
      getLeads(),
    ]);

    return NextResponse.json({
      success: true,
      listings: listings.length,
      listingsData: listings,
      leads: leads.length,
      leadsData: leads,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
