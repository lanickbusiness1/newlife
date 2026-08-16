import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';
import { getAdminSupabaseConfig, type Environment } from './config.js';

export function createAdminClient(env: Environment = process.env): SupabaseClient<Database> {
  const { url, serviceRoleKey } = getAdminSupabaseConfig(env);
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
