import type {
  LegalCondition,
  LegalRegime,
  LegalRule,
  LegalSource,
  LegalVerdict,
} from './types.js';
import { verifyLegalSource } from './source-verifier.js';

export interface LegalRuleDraft {
  id: string;
  countryCode: string;
  regime: LegalRegime;
  sourceId: string;
  article: string;
  version: string;
  requiredFacts: string[];
  conditions: LegalCondition[];
  exceptions: LegalCondition[];
  onMatch: LegalVerdict;
  onNoMatch: LegalVerdict;
}

export function compileLegalRule(
  draft: LegalRuleDraft,
  verifiedSources: LegalSource[],
): LegalRule {
  const source = verifiedSources.find((candidate) => candidate.id === draft.sourceId);
  const sourceVerification = source ? verifyLegalSource(source) : null;
  const exactArticle = draft.article.trim();

  const technicallyValidated = Boolean(
    exactArticle &&
      source &&
      source.effectiveStatus === 'VERIFIED' &&
      sourceVerification?.status === 'SOURCE_VERIFIED',
  );

  return {
    id: draft.id,
    countryCode: draft.countryCode,
    regime: draft.regime,
    sourceId: draft.sourceId,
    article: exactArticle,
    version: draft.version,
    effectiveStatus: source?.effectiveStatus ?? 'INCOMPLETE',
    lifecycleStatus: technicallyValidated ? 'TECHNICALLY_VALIDATED' : 'REVIEW_REQUIRED',
    conditions: structuredClone(draft.conditions),
    exceptions: structuredClone(draft.exceptions),
    requiredFacts: [...draft.requiredFacts],
    verdicts: [...new Set<LegalVerdict>([draft.onMatch, draft.onNoMatch, 'REVIEW_REQUIRED'])],
    onMatch: draft.onMatch,
    onNoMatch: draft.onNoMatch,
  };
}
