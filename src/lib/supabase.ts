import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
// Public preview never exposes authenticated database records.
export const accessMode = process.env.NEXT_PUBLIC_ACCESS_MODE === 'authenticated' ? 'authenticated' : 'open';
export const dataMode = accessMode === 'authenticated' && process.env.NEXT_PUBLIC_DATA_MODE === 'supabase' ? 'supabase' : 'demo';
export const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configure a URL e a chave pública do Supabase.');
  client ??= createClient(url, key);
  return client;
}

export const sharedStorage = process.env.NEXT_PUBLIC_OPEN_STORAGE === 'supabase';
