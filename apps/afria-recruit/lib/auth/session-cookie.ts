const COOKIE_NAME = 'afria_recruit_session';

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cookieToken(request: Request): string | null {
  const raw = request.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== COOKIE_NAME) continue;
    const value = rest.join('=');
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

export function buildAccessTokenCookie(accessToken: string, maxAgeSeconds: number, secure: boolean): string {
  const token = accessToken.trim();
  if (!token) throw new Error('Access token is required');
  const maxAge = Math.max(1, Math.floor(maxAgeSeconds));
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

export function clearAccessTokenCookie(secure: boolean): string {
  return [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
    secure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

export function readAccessTokenFromRequest(request: Request): string | null {
  return bearerToken(request) ?? cookieToken(request);
}
