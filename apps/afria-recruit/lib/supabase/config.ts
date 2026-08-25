export type Environment = Record<string, string | undefined>;

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getPublicSupabaseConfig(env: Environment = process.env) {
  return {
    url: required(env, 'NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: required(env, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  };
}

export function getAdminSupabaseConfig(env: Environment = process.env) {
  const url = required(env, 'NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error('Supabase service role key is required');
  return { url, serviceRoleKey };
}
