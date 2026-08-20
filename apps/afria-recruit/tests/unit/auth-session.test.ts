import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccessTokenCookie, clearAccessTokenCookie, readAccessTokenFromRequest } from '../../lib/auth/session-cookie.js';

test('live session cookie is HttpOnly, SameSite Strict and scoped to the whole app', () => {
  const cookie = buildAccessTokenCookie('synthetic-access-token', 3600, true);
  assert.match(cookie, /^afria_recruit_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /Max-Age=3600/i);
  assert.match(cookie, /Secure/i);
});

test('development session cookie remains HttpOnly without requiring HTTPS', () => {
  const cookie = buildAccessTokenCookie('synthetic-access-token', 1800, false);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.doesNotMatch(cookie, /;\s*Secure/i);
});

test('session reader accepts the HttpOnly cookie and keeps bearer precedence for CI E2E', () => {
  const cookieRequest = new Request('https://candidate.local/api', { headers: { cookie: 'other=x; afria_recruit_session=cookie-token' } });
  assert.equal(readAccessTokenFromRequest(cookieRequest), 'cookie-token');

  const bearerRequest = new Request('https://candidate.local/api', {
    headers: { cookie: 'afria_recruit_session=cookie-token', authorization: 'Bearer e2e-bearer-token' },
  });
  assert.equal(readAccessTokenFromRequest(bearerRequest), 'e2e-bearer-token');
});

test('logout cookie expires the session immediately', () => {
  const cookie = clearAccessTokenCookie(true);
  assert.match(cookie, /Max-Age=0/i);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
});
