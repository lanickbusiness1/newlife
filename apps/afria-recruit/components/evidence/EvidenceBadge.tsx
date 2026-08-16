import { normalizeEvidenceLevel } from '../../lib/domain/evidence.js';

export function EvidenceBadge({ status }: { status: string }) {
  const level = normalizeEvidenceLevel(status);
  return <span className={`evidence-badge evidence-${level.toLowerCase()}`}>{level}</span>;
}
