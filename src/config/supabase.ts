import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes('YOUR_') && !anonKey.includes('YOUR_'));
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: typeof window !== 'undefined',
      },
    });
  }
  return client;
}

export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      'Supabase não configurado. Copie .env.example para .env e preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return sb;
}
