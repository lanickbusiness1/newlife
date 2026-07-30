import { describe, expect, it } from 'vitest';
import { canAccessDossier, createOpaqueRefreshToken, hashPassword, hashRefreshToken, hasPermission, verifyPassword, type AuthClaims } from './security.js';

const applicant: AuthClaims = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'applicant@example.bj',
  actorType: 'APPLICANT',
  roles: ['APPLICANT'],
  permissions: ['DOSSIER_CREATE', 'DOSSIER_READ_OWN', 'DOSSIER_UPDATE_OWN'],
};

const authority: AuthClaims = {
  sub: '22222222-2222-4222-8222-222222222222',
  email: 'authority@apdp.bj',
  actorType: 'APDP_INTERNAL',
  roles: ['DECISION_AUTHORITY'],
  permissions: ['DOSSIER_READ_ALL', 'DECISION_VALIDATE'],
};

describe('APDP BJ security', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const hash = await hashPassword('Correct-Horse-Battery-Staple');
    expect(hash).not.toContain('Correct-Horse');
    expect(await verifyPassword('Correct-Horse-Battery-Staple', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('creates opaque refresh tokens whose stored value is only a hash', () => {
    const refresh = createOpaqueRefreshToken();
    expect(refresh.token).not.toBe(refresh.hash);
    expect(hashRefreshToken(refresh.token)).toBe(refresh.hash);
    expect(refresh.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('enforces applicant ownership through ABAC', () => {
    expect(canAccessDossier(applicant, { applicant_id: applicant.sub, status: 'DRAFT' }, 'update')).toBe(true);
    expect(canAccessDossier(applicant, { applicant_id: applicant.sub, status: 'SUBMITTED' }, 'update')).toBe(false);
    expect(canAccessDossier(applicant, { applicant_id: authority.sub, status: 'DRAFT' }, 'read')).toBe(false);
  });

  it('grants authority privileges through RBAC permissions', () => {
    expect(hasPermission(authority, 'DECISION_VALIDATE')).toBe(true);
    expect(canAccessDossier(authority, { applicant_id: applicant.sub, status: 'UNDER_ANALYSIS' }, 'read')).toBe(true);
  });
});
