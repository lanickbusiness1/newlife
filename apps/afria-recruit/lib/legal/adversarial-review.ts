import type { LegalRegime, LegalRule, LegalSource } from './types.js';

export type AdversarialFindingCode =
  | 'OMITTED_EXCEPTION'
  | 'SOURCE_NOT_CURRENT'
  | 'SPECIAL_STATUTE_CONFLICT'
  | 'NON_DISCRIMINATION_FAILURE'
  | 'NON_DISCRIMINATION_REVIEW_REQUIRED'
  | 'RULE_REGIME_MISMATCH'
  | 'SUPRANATIONAL_CONFLICT'
  | 'SOURCE_MISSING';

export interface AdversarialFinding {
  code: AdversarialFindingCode;
  blocking: true;
  detail: string;
}

export interface LegalAdversarialEvidenceSet {
  sources: LegalSource[];
  applicableRegime: LegalRegime;
  requiredExceptionIds: string[];
  representedExceptionIds: string[];
  specialSourceIds: string[];
  supranationalConflicts: string[];
  nonDiscriminationStatus: 'PASS' | 'FAIL' | 'REVIEW_REQUIRED';
}

export interface AdversarialReviewResult {
  status: 'CROSS_CHECKED' | 'BLOCKED';
  findings: AdversarialFinding[];
}

export function crossCheckRule(
  rule: LegalRule,
  evidence: LegalAdversarialEvidenceSet,
): AdversarialReviewResult {
  const findings: AdversarialFinding[] = [];
  const source = evidence.sources.find((candidate) => candidate.id === rule.sourceId);

  if (!source) {
    findings.push({ code: 'SOURCE_MISSING', blocking: true, detail: rule.sourceId });
  } else if (source.effectiveStatus !== 'VERIFIED') {
    findings.push({ code: 'SOURCE_NOT_CURRENT', blocking: true, detail: `${source.id}:${source.effectiveStatus}` });
  }

  const represented = new Set(evidence.representedExceptionIds);
  for (const exceptionId of evidence.requiredExceptionIds) {
    if (!represented.has(exceptionId)) {
      findings.push({ code: 'OMITTED_EXCEPTION', blocking: true, detail: exceptionId });
    }
  }

  if (rule.regime !== evidence.applicableRegime) {
    findings.push({
      code: 'RULE_REGIME_MISMATCH',
      blocking: true,
      detail: `${rule.regime}!=${evidence.applicableRegime}`,
    });
  }

  for (const specialSourceId of evidence.specialSourceIds) {
    const special = evidence.sources.find((candidate) => candidate.id === specialSourceId);
    if (!special) continue;
    if (special.conflictsWith?.includes(rule.sourceId) || source?.conflictsWith?.includes(special.id)) {
      findings.push({ code: 'SPECIAL_STATUTE_CONFLICT', blocking: true, detail: `${rule.sourceId}<->${special.id}` });
    }
  }

  if (evidence.nonDiscriminationStatus === 'FAIL') {
    findings.push({ code: 'NON_DISCRIMINATION_FAILURE', blocking: true, detail: rule.id });
  } else if (evidence.nonDiscriminationStatus === 'REVIEW_REQUIRED') {
    findings.push({ code: 'NON_DISCRIMINATION_REVIEW_REQUIRED', blocking: true, detail: rule.id });
  }

  for (const conflict of evidence.supranationalConflicts) {
    findings.push({ code: 'SUPRANATIONAL_CONFLICT', blocking: true, detail: conflict });
  }

  findings.sort((left, right) => left.code.localeCompare(right.code) || left.detail.localeCompare(right.detail));
  return { status: findings.length === 0 ? 'CROSS_CHECKED' : 'BLOCKED', findings };
}
