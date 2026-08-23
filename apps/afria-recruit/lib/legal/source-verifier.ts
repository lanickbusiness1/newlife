import type { LegalSource } from './types.js';

export type LegalSourceVerificationStatus =
  | 'SOURCE_VERIFIED'
  | 'SOURCE_CONFLICT'
  | 'SOURCE_INCOMPLETE';

export interface LegalSourceVerification {
  sourceId: string;
  status: LegalSourceVerificationStatus;
  reasons: string[];
}

export function verifyLegalSource(source: LegalSource): LegalSourceVerification {
  const reasons: string[] = [];

  for (const [field, value] of [
    ['id', source.id],
    ['title', source.title],
    ['authority', source.authority],
    ['sourceUrl', source.sourceUrl],
    ['effectiveStatus', source.effectiveStatus],
  ] as const) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      reasons.push(`MISSING_${field.toUpperCase()}`);
    }
  }

  if (source.effectiveStatus === 'CONFLICT') {
    return { sourceId: source.id, status: 'SOURCE_CONFLICT', reasons: ['SOURCE_METADATA_CONFLICT', ...reasons] };
  }

  if (source.effectiveStatus === 'INCOMPLETE' || reasons.length > 0) {
    return { sourceId: source.id, status: 'SOURCE_INCOMPLETE', reasons };
  }

  return { sourceId: source.id, status: 'SOURCE_VERIFIED', reasons: [] };
}
