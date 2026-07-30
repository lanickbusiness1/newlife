import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export type ActorType = 'APPLICANT' | 'APDP_INTERNAL';

export interface AuthClaims {
  sub: string;
  email: string;
  actorType: ActorType;
  roles: string[];
  permissions: string[];
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createOpaqueRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hasPermission(claims: AuthClaims, permission: string): boolean {
  return claims.permissions.includes(permission) || claims.roles.includes('SYSTEM_ADMIN');
}

export function canAccessDossier(
  claims: AuthClaims,
  dossier: { applicant_id: string; assigned_to?: string | null; status: string },
  action: 'read' | 'update',
): boolean {
  if (claims.roles.includes('SYSTEM_ADMIN') || claims.permissions.includes('DOSSIER_READ_ALL')) return true;
  if (claims.actorType === 'APPLICANT') {
    if (dossier.applicant_id !== claims.sub) return false;
    return action === 'read' || dossier.status === 'DRAFT';
  }
  return dossier.assigned_to === claims.sub;
}
