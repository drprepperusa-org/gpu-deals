import { getSupabase } from './supabase';

export async function getDiscordEnabled(): Promise<boolean> {
  const sb = getSupabase();
  const { data } = await sb
    .from('settings')
    .select('value')
    .eq('key', 'discord_enabled')
    .maybeSingle();

  // Default to enabled if no setting exists
  if (!data) return true;
  return data.value === 'true';
}

export async function setDiscordEnabled(enabled: boolean): Promise<void> {
  const sb = getSupabase();
  await sb.from('settings').upsert(
    { key: 'discord_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
}
