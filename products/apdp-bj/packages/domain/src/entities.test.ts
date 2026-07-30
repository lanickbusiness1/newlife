import { describe, expect, it } from 'vitest';
import { decisionSchema, dossierSchema, documentSchema } from './entities.js';

const uuid = '11111111-1111-4111-8111-111111111111';
const uuid2 = '22222222-2222-4222-8222-222222222222';

 describe('APDP BJ domain entities', () => {
  it('accepts a canonical dossier', () => {
    const result = dossierSchema.safeParse({
      id: uuid,
      reference: 'APDP-BJ-2026-000001',
      organizationId: uuid2,
      applicantId: uuid,
      assignedTo: null,
      requestType: 'AUTHORIZATION',
      status: 'DRAFT',
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it('requires a cryptographic document hash', () => {
    const result = documentSchema.safeParse({
      id: uuid,
      dossierId: uuid2,
      documentType: 'PIA_REPORT',
      fileName: 'pia.pdf',
      storageKey: 'dossiers/1/pia.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      sha256: 'invalid',
      version: 1,
      uploadedBy: uuid,
    });
    expect(result.success).toBe(false);
  });

  it('forbids a validated decision without a human validator', () => {
    const result = decisionSchema.safeParse({
      id: uuid,
      dossierId: uuid2,
      decisionType: 'APPROVAL',
      status: 'VALIDATED',
      reasoning: 'The dossier satisfies the applicable requirements.',
      conditions: [],
      preparedBy: uuid,
      validatedBy: null,
      validatedAt: null,
      signedHash: null,
    });
    expect(result.success).toBe(false);
  });
});