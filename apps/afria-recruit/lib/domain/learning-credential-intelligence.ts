export type LearningClassification =
  | 'FREE_CERTIFIED'
  | 'FREE_CERTIFIED_RESTRICTED'
  | 'FREE_LEARNING_PAID_CREDENTIAL'
  | 'PAID_CERTIFIED'
  | 'FREE_LEARNING_NO_CREDENTIAL'
  | 'SPECIALIZED_CERTIFIED'
  | 'UNVERIFIED_CREDENTIAL'
  | 'INELIGIBLE';

export type VerificationStatus = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'REJECTED';
export type EligibilityGate = 'PASS' | 'FAIL' | 'REVIEW';
export type RecommendationDecision = 'PRIORITY' | 'ELIGIBLE' | 'REVIEW' | 'REJECTED';
export type CandidateSkillEvidenceState =
  | 'declared'
  | 'inferred'
  | 'assessed'
  | 'credential-evidenced'
  | 'employer-validated';

export interface VerifiedCost {
  amount: number | null;
  currency: string | null;
  verified: boolean;
}

export interface LearningOpportunity {
  id: string;
  provider: string;
  courseTitle: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  countryEligibility: string[];
  languages: string[];
  sectors: string[];
  skills: string[];
  durationHours: number | null;
  learningCost: VerifiedCost;
  assessmentRequired: boolean | null;
  assessmentVerified: boolean | null;
  credentialAvailable: boolean | null;
  credentialCost: VerifiedCost;
  credentialIssuer: string | null;
  accreditationOrRecognition: string | null;
  credentialExpiry: string | null;
  evidenceRefs: string[];
  verificationStatus: VerificationStatus;
  misleadingClaimScore: number;
  advertisedAsFreeCertification?: boolean;
  specialized?: boolean;
}

export interface CandidateLearningContext {
  countryCode: string;
  languages: string[];
  targetSectors: string[];
  skillGaps: string[];
}

export interface LearningEvaluation {
  opportunityId: string;
  classification: LearningClassification;
  eligibilityGate: EligibilityGate;
  decision: RecommendationDecision;
  closedSkills: string[];
  blockingReasons: string[];
  evidenceRefs: string[];
  recommendationScore: number | null;
  explanation: string;
}

export interface CandidateSkillEvidence {
  skill: string;
  evidenceState: CandidateSkillEvidenceState;
  evidenceRefs: string[];
}

export interface CredentialCompletion {
  verified: boolean;
  credentialEvidenceRef: string;
}

export interface EmployabilityDelta {
  before: number;
  after: number;
  delta: number;
}

const skillAliases = new Map<string, string>([
  ['fleet management', 'fleet'],
  ['fleet operations', 'fleet'],
  ['fleet', 'fleet'],
  ['warehouse', 'warehousing'],
  ['warehouse management', 'warehousing'],
  ['warehousing', 'warehousing'],
  ['asset management', 'asset management'],
  ['procurement', 'procurement'],
]);

const skillEvidenceRank: Record<CandidateSkillEvidenceState, number> = {
  declared: 1,
  inferred: 2,
  assessed: 3,
  'credential-evidenced': 4,
  'employer-validated': 5,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizedCountry(value: string): string {
  return value.trim().toUpperCase();
}

function normalizedLanguage(value: string): string {
  return value.trim().toLowerCase();
}

function normalizedSector(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function hasPrimaryEvidence(opportunity: LearningOpportunity): boolean {
  return Boolean(
    opportunity.provider.trim()
    && opportunity.courseTitle.trim()
    && /^https?:\/\//i.test(opportunity.sourceUrl.trim())
    && opportunity.evidenceRefs.some((reference) => reference.trim().length > 0),
  );
}

function costsAreMateriallyVerified(opportunity: LearningOpportunity): boolean {
  if (!opportunity.learningCost.verified || opportunity.learningCost.amount === null) return false;
  if (opportunity.credentialAvailable === true) {
    return opportunity.credentialCost.verified && opportunity.credentialCost.amount !== null;
  }
  return opportunity.credentialAvailable === false;
}

function assessmentConditionVerified(opportunity: LearningOpportunity): boolean {
  if (opportunity.assessmentRequired !== true) return true;
  return opportunity.assessmentVerified === true;
}

function isCountryRestricted(opportunity: LearningOpportunity): boolean {
  const countries = opportunity.countryEligibility.map(normalizedCountry).filter(Boolean);
  return countries.length > 0 && !countries.includes('*');
}

function countryFits(opportunity: LearningOpportunity, context: CandidateLearningContext): boolean {
  const countries = opportunity.countryEligibility.map(normalizedCountry).filter(Boolean);
  if (countries.includes('*')) return true;
  if (countries.length === 0) return false;
  return countries.includes(normalizedCountry(context.countryCode));
}

function languageFits(opportunity: LearningOpportunity, context: CandidateLearningContext): boolean {
  const offered = new Set(opportunity.languages.map(normalizedLanguage).filter(Boolean));
  if (offered.size === 0) return false;
  return context.languages.some((language) => offered.has(normalizedLanguage(language)));
}

function sectorFits(opportunity: LearningOpportunity, context: CandidateLearningContext): boolean {
  if (!opportunity.specialized) return true;
  const sectors = new Set(opportunity.sectors.map(normalizedSector).filter(Boolean));
  if (sectors.size === 0) return false;
  return context.targetSectors.some((sector) => sectors.has(normalizedSector(sector)));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizedTaughtSkills(opportunity: LearningOpportunity): string[] {
  return uniqueStrings(
    opportunity.skills
      .map(normalizeSkillToken)
      .filter((skill) => skill.length > 0),
  );
}

function closedTargetSkills(opportunity: LearningOpportunity, context: CandidateLearningContext): string[] {
  const taught = new Set(normalizedTaughtSkills(opportunity));
  return uniqueStrings(
    context.skillGaps
      .map(normalizeSkillToken)
      .filter((skill) => skill.length > 0 && taught.has(skill)),
  );
}

function scoreDuration(durationHours: number | null): number {
  if (durationHours === null || !Number.isFinite(durationHours) || durationHours < 0) return 0;
  if (durationHours <= 5) return 5;
  if (durationHours <= 10) return 3;
  if (durationHours <= 20) return 1;
  return 0;
}

function scoreCost(opportunity: LearningOpportunity): number {
  const learning = opportunity.learningCost.amount;
  const credential = opportunity.credentialAvailable === true ? opportunity.credentialCost.amount : 0;
  if (learning === null || credential === null) return 0;
  const total = learning + credential;
  if (total === 0) return 5;
  if (total <= 25) return 3;
  if (total <= 100) return 1;
  return 0;
}

function computeRecommendationScore(
  opportunity: LearningOpportunity,
  context: CandidateLearningContext,
  closedSkills: string[],
): number {
  const normalizedGaps = uniqueStrings(context.skillGaps.map(normalizeSkillToken).filter(Boolean));
  const gapClosure = normalizedGaps.length === 0
    ? 0
    : Math.round(45 * (closedSkills.length / normalizedGaps.length));
  const credentialVerification = opportunity.verificationStatus === 'VERIFIED'
    && opportunity.credentialAvailable === true
    && Boolean(opportunity.credentialIssuer?.trim())
    ? 20
    : 0;
  const misleadingPenalty = Math.round(5 * (clamp(opportunity.misleadingClaimScore, 0, 100) / 100));

  return clamp(
    gapClosure
      + credentialVerification
      + 10
      + 10
      + scoreCost(opportunity)
      + scoreDuration(opportunity.durationHours)
      - misleadingPenalty,
    0,
    100,
  );
}

function buildExplanation(
  opportunity: LearningOpportunity,
  classification: LearningClassification,
  closedSkills: string[],
  eligibilityGate: EligibilityGate,
  blockingReasons: string[],
  score: number | null,
): string {
  if (eligibilityGate !== 'PASS') {
    return `${opportunity.courseTitle}: recommandation non publiée (${blockingReasons.join(', ')}).`;
  }

  const duration = opportunity.durationHours === null ? 'durée non renseignée' : `${opportunity.durationHours} h`;
  const cost = opportunity.learningCost.amount === 0 && opportunity.credentialCost.amount === 0
    ? 'coût apprentissage et credential vérifié à 0'
    : 'coût vérifié non nul';
  return `${opportunity.courseTitle}: ${classification}; ferme ${closedSkills.join(', ')}; ${duration}; ${cost}; score ${score}/100.`;
}

export function normalizeSkillToken(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  return skillAliases.get(normalized) ?? normalized;
}

export function classifyLearningOpportunity(opportunity: LearningOpportunity): LearningClassification {
  if (
    opportunity.verificationStatus !== 'VERIFIED'
    || !hasPrimaryEvidence(opportunity)
    || !costsAreMateriallyVerified(opportunity)
    || !assessmentConditionVerified(opportunity)
  ) {
    return 'UNVERIFIED_CREDENTIAL';
  }

  const learningAmount = opportunity.learningCost.amount;
  const credentialAmount = opportunity.credentialCost.amount;

  if (opportunity.credentialAvailable === false && learningAmount === 0) {
    return 'FREE_LEARNING_NO_CREDENTIAL';
  }

  if (opportunity.credentialAvailable !== true || !opportunity.credentialIssuer?.trim()) {
    return 'UNVERIFIED_CREDENTIAL';
  }

  if (learningAmount === 0 && credentialAmount === 0) {
    if (opportunity.specialized) return 'SPECIALIZED_CERTIFIED';
    if (isCountryRestricted(opportunity)) return 'FREE_CERTIFIED_RESTRICTED';
    return 'FREE_CERTIFIED';
  }

  if (learningAmount === 0 && credentialAmount !== null && credentialAmount > 0) {
    return 'FREE_LEARNING_PAID_CREDENTIAL';
  }

  if (learningAmount !== null && learningAmount > 0) {
    return 'PAID_CERTIFIED';
  }

  return 'UNVERIFIED_CREDENTIAL';
}

export function evaluateLearningOpportunity(
  opportunity: LearningOpportunity,
  context: CandidateLearningContext,
): LearningEvaluation {
  const classification = classifyLearningOpportunity(opportunity);
  const closedSkills = closedTargetSkills(opportunity, context);
  const blockingReasons: string[] = [];

  if (!hasPrimaryEvidence(opportunity)) blockingReasons.push('EVIDENCE_MISSING');
  if (opportunity.verificationStatus !== 'VERIFIED') blockingReasons.push('EVIDENCE_UNVERIFIED');
  if (classification === 'UNVERIFIED_CREDENTIAL') blockingReasons.push('CREDENTIAL_CLAIM_UNVERIFIED');
  if (!countryFits(opportunity, context)) blockingReasons.push('COUNTRY_INELIGIBLE');
  if (!languageFits(opportunity, context)) blockingReasons.push('LANGUAGE_INELIGIBLE');
  if (!sectorFits(opportunity, context)) blockingReasons.push('SPECIALIZATION_MISMATCH');
  if (!assessmentConditionVerified(opportunity)) blockingReasons.push('ASSESSMENT_UNVERIFIED');
  if (
    opportunity.advertisedAsFreeCertification === true
    && (classification === 'FREE_LEARNING_PAID_CREDENTIAL' || classification === 'PAID_CERTIFIED')
  ) {
    blockingReasons.push('MISLEADING_FREE_CERTIFICATION');
  }
  if (closedSkills.length === 0) blockingReasons.push('NO_TARGET_GAP_CLOSURE');

  const eligibilityGate: EligibilityGate = blockingReasons.length > 0 ? 'FAIL' : 'PASS';
  const recommendationScore = eligibilityGate === 'PASS'
    ? computeRecommendationScore(opportunity, context, closedSkills)
    : null;
  const decision: RecommendationDecision = eligibilityGate === 'FAIL'
    ? 'REJECTED'
    : recommendationScore !== null && recommendationScore >= 75
      ? 'PRIORITY'
      : 'ELIGIBLE';

  return {
    opportunityId: opportunity.id,
    classification,
    eligibilityGate,
    decision,
    closedSkills,
    blockingReasons: uniqueStrings(blockingReasons),
    evidenceRefs: uniqueStrings(opportunity.evidenceRefs.filter((reference) => reference.trim().length > 0)),
    recommendationScore,
    explanation: buildExplanation(
      opportunity,
      classification,
      closedSkills,
      eligibilityGate,
      uniqueStrings(blockingReasons),
      recommendationScore,
    ),
  };
}

export function rankLearningOpportunities(
  opportunities: LearningOpportunity[],
  context: CandidateLearningContext,
): LearningEvaluation[] {
  const gateRank: Record<EligibilityGate, number> = { PASS: 0, REVIEW: 1, FAIL: 2 };
  return opportunities
    .map((opportunity) => evaluateLearningOpportunity(opportunity, context))
    .sort((left, right) => {
      const gateDifference = gateRank[left.eligibilityGate] - gateRank[right.eligibilityGate];
      if (gateDifference !== 0) return gateDifference;
      const scoreDifference = (right.recommendationScore ?? -1) - (left.recommendationScore ?? -1);
      if (scoreDifference !== 0) return scoreDifference;
      return left.opportunityId.localeCompare(right.opportunityId);
    });
}

export function applyVerifiedCredentialCompletion(
  currentSkills: CandidateSkillEvidence[],
  opportunity: LearningOpportunity,
  completion: CredentialCompletion,
): CandidateSkillEvidence[] {
  if (!completion.verified || !completion.credentialEvidenceRef.trim()) {
    throw new Error('Verified credential completion evidence is required.');
  }
  if (
    opportunity.verificationStatus !== 'VERIFIED'
    || opportunity.credentialAvailable !== true
    || !opportunity.credentialIssuer?.trim()
    || opportunity.evidenceRefs.length === 0
  ) {
    throw new Error('Learning opportunity does not carry a verified credential contract.');
  }

  const credentialEvidenceRef = completion.credentialEvidenceRef.trim();
  const result = currentSkills.map((item) => ({
    ...item,
    evidenceRefs: [...item.evidenceRefs],
  }));

  for (const taughtSkill of normalizedTaughtSkills(opportunity)) {
    const existing = result.find((item) => normalizeSkillToken(item.skill) === taughtSkill);
    if (!existing) {
      result.push({
        skill: taughtSkill,
        evidenceState: 'credential-evidenced',
        evidenceRefs: [credentialEvidenceRef],
      });
      continue;
    }

    existing.skill = taughtSkill;
    if (skillEvidenceRank[existing.evidenceState] < skillEvidenceRank['credential-evidenced']) {
      existing.evidenceState = 'credential-evidenced';
    }
    existing.evidenceRefs = uniqueStrings([...existing.evidenceRefs, credentialEvidenceRef]);
  }

  return result;
}

export function computeEmployabilityDelta(before: number, after: number): EmployabilityDelta {
  const valid = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;
  if (!valid(before) || !valid(after)) {
    throw new Error('Employability scores must be finite values within 0..100.');
  }
  return { before, after, delta: after - before };
}
