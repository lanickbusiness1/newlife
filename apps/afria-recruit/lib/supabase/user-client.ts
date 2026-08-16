import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';
import { getPublicSupabaseConfig, type Environment } from './config.js';

const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

export function createPublicClient(env: Environment = process.env): SupabaseClient<Database> {
  const { url, publishableKey } = getPublicSupabaseConfig(env);
  return createClient<Database>(url, publishableKey, { auth: authOptions });
}

export function createUserTokenClient(
  accessToken: string,
  env: Environment = process.env,
): SupabaseClient<Database> {
  const { url, publishableKey } = getPublicSupabaseConfig(env);
  return createClient<Database>(url, publishableKey, {
    auth: authOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
