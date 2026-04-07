import { NextResponse } from 'next/server';
import { getDiscordEnabled, setDiscordEnabled } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const discordEnabled = await getDiscordEnabled();
    return NextResponse.json({ success: true, discordEnabled });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { discordEnabled } = await request.json();
    await setDiscordEnabled(discordEnabled);
    return NextResponse.json({ success: true, discordEnabled });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
