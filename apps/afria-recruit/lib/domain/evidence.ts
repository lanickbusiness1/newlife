export type EvidenceLevel = 'DECLARED' | 'EVIDENCED' | 'VERIFIED';

export function normalizeEvidenceLevel(status: string | null | undefined): EvidenceLevel {
  const normalized = status?.trim().toLowerCase() ?? '';
  if (normalized === 'verified') return 'VERIFIED';
  if (['evidenced', 'supported', 'documented'].includes(normalized)) return 'EVIDENCED';
  return 'DECLARED';
}

export function evidenceIsSubstantiated(status: string | null | undefined): boolean {
  return normalizeEvidenceLevel(status) !== 'DECLARED';
}
