import { buildAccessTokenCookie, clearAccessTokenCookie } from '@/lib/auth/session-cookie';
import { createPublicClient } from '@/lib/supabase/user-client';

function json(status: number, body: Record<string, unknown>, setCookie?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (setCookie) headers.set('Set-Cookie', setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid session request' });
  }

  const accessToken = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as { accessToken?: unknown }).accessToken
    : null;
  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    return json(400, { error: 'Invalid session request' });
  }

  const client = createPublicClient();
  const { data, error } = await client.auth.getUser(accessToken.trim());
  if (error || !data.user) return json(401, { error: 'Authentication required' });

  const cookie = buildAccessTokenCookie(accessToken.trim(), 3600, process.env.NODE_ENV === 'production');
  return json(200, { authenticated: true }, cookie);
}

export async function DELETE() {
  return json(200, { authenticated: false }, clearAccessTokenCookie(process.env.NODE_ENV === 'production'));
}
