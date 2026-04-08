import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '7');
  const type = searchParams.get('type') || 'all';

  try {
    const sb = getSupabase();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let query = sb
      .from('alerts')
      .select('*')
      .gt('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

    if (type !== 'all') {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      alerts: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
