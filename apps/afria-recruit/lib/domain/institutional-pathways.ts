export type ProgramState =
  | 'VERIFIED_OPEN'
  | 'CLOSED'
  | 'RECURRING'
  | 'COUNTRY_DEPENDENT'
  | 'SPONSOR_DEPENDENT'
  | 'REVIEW_REQUIRED';

export type EligibilityRuleKind =
  | 'nationality'
  | 'age'
  | 'education'
  | 'experience'
  | 'language'
  | 'sponsor'
  | 'country_participation'
  | 'post_graduation_window'
  | 'residency'
  | 'document';

export type EducationLevel = 'secondary' | 'bachelor' | 'master' | 'doctorate';
export type RuleEvaluationStatus = 'PASS' | 'FAIL' | 'REVIEW_REQUIRED';
export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'REVIEW_REQUIRED';
export type PathwayRecommendation = 'APPLY' | 'PREPARE' | 'SKIP';

export interface EligibilityRule {
  id: string;
  kind: EligibilityRuleKind;
  label: string;
  sourceRef: string;
  allowedCodes?: string[];
  requiredCode?: string;
  minimum?: number;
  maximum?: number;
  minimumEducationLevel?: EducationLevel;
  requiredDocumentCode?: string;
}

export interface InstitutionalPathway {
  id: string;
  institution: string;
  title: string;
  programType: string;
  sourceRef: string;
  sourceVerifiedAt: string;
  state: ProgramState;
  hardRules: EligibilityRule[];
}

export interface CandidateEligibilityProfile {
  nationalityCodes?: string[];
  age?: number;
  highestEducationLevel?: EducationLevel;
  yearsExperience?: number;
  languageCodes?: string[];
  sponsorCountryCode?: string;
  participatingCountryCodes?: string[];
  monthsSinceGraduation?: number;
  residenceCountryCode?: string;
  availableDocumentCodes?: string[];
}

export interface RuleEvaluation {
  ruleId: string;
  label: string;
  status: RuleEvaluationStatus;
  sourceRef: string;
  explanation: string;
}

export interface PathwayEligibilityResult {
  status: EligibilityStatus;
  rules: RuleEvaluation[];
}

export interface InstitutionalPathwayRecommendation {
  pathwayId: string;
  pathwayTitle: string;
  programmeState: ProgramState;
  fitScore: number;
  eligibility: PathwayEligibilityResult;
  recommendation: PathwayRecommendation;
}

const EDUCATION_RANK: Record<EducationLevel, number> = {
  secondary: 0,
  bachelor: 1,
  master: 2,
  doctorate: 3,
};

const PRIORITY: Record<PathwayRecommendation, number> = {
  APPLY: 0,
  PREPARE: 1,
  SKIP: 2,
};

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`Invalid normalized source data: ${field} must not be blank.`);
}

function requireFiniteNumber(value: number, field: string): void {
  if (!Number.isFinite(value)) throw new Error(`Invalid normalized source data: ${field} must be finite.`);
}

function validateRule(rule: EligibilityRule): void {
  requireText(rule.id, 'rule id');
  requireText(rule.label, 'rule label');
  requireText(rule.sourceRef, 'rule sourceRef');

  if (rule.minimum !== undefined) requireFiniteNumber(rule.minimum, `${rule.kind} minimum`);
  if (rule.maximum !== undefined) requireFiniteNumber(rule.maximum, `${rule.kind} maximum`);
  if (rule.minimum !== undefined && rule.maximum !== undefined && rule.minimum > rule.maximum) {
    throw new Error(`Invalid normalized source data: ${rule.kind} minimum cannot exceed maximum.`);
  }

  switch (rule.kind) {
    case 'nationality':
    case 'language':
    case 'sponsor':
    case 'residency':
      if (!rule.allowedCodes?.some((code) => code.trim())) {
        throw new Error(`Invalid normalized source data: ${rule.kind} rule requires allowedCodes.`);
      }
      break;
    case 'age':
      if (rule.minimum === undefined && rule.maximum === undefined) {
        throw new Error('Invalid normalized source data: age rule requires minimum or maximum.');
      }
      break;
    case 'education':
      if (!rule.minimumEducationLevel) {
        throw new Error('Invalid normalized source data: education rule requires minimumEducationLevel.');
      }
      break;
    case 'experience':
      if (rule.minimum === undefined) {
        throw new Error('Invalid normalized source data: experience rule requires minimum.');
      }
      break;
    case 'country_participation':
      if (!rule.requiredCode?.trim()) {
        throw new Error('Invalid normalized source data: country participation rule requires requiredCode.');
      }
      break;
    case 'post_graduation_window':
      if (rule.minimum === undefined && rule.maximum === undefined) {
        throw new Error('Invalid normalized source data: post-graduation window requires minimum or maximum.');
      }
      break;
    case 'document':
      if (!rule.requiredDocumentCode?.trim()) {
        throw new Error('Invalid normalized source data: document rule requires requiredDocumentCode.');
      }
      break;
  }
}

function validatePathway(pathway: InstitutionalPathway): void {
  requireText(pathway.id, 'pathway id');
  requireText(pathway.title, 'pathway title');
  requireText(pathway.sourceRef, 'pathway sourceRef');
  requireText(pathway.sourceVerifiedAt, 'sourceVerifiedAt');
  pathway.hardRules.forEach(validateRule);
}

function validateFitScore(fitScore: number): void {
  if (!Number.isFinite(fitScore) || fitScore < 0 || fitScore > 100) {
    throw new Error('Invalid fit score: expected a finite value between 0 and 100.');
  }
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function codesIntersect(actual: string[], allowed: string[]): boolean {
  const allowedSet = new Set(allowed.map(normalizeCode));
  return actual.map(normalizeCode).some((code) => allowedSet.has(code));
}

function evaluation(
  rule: EligibilityRule,
  status: RuleEvaluationStatus,
  explanation: string,
): RuleEvaluation {
  return {
    ruleId: rule.id,
    label: rule.label,
    status,
    sourceRef: rule.sourceRef,
    explanation,
  };
}

function missing(rule: EligibilityRule): RuleEvaluation {
  return evaluation(
    rule,
    'REVIEW_REQUIRED',
    'Required candidate fact is missing; human/source review is required.',
  );
}

function compareNumeric(
  rule: EligibilityRule,
  value: number | undefined,
  label: string,
): RuleEvaluation {
  if (value === undefined) return missing(rule);
  if (rule.minimum !== undefined && value < rule.minimum) {
    return evaluation(rule, 'FAIL', `${label} is below the source-backed minimum.`);
  }
  if (rule.maximum !== undefined && value > rule.maximum) {
    return evaluation(rule, 'FAIL', `${label} exceeds the source-backed maximum.`);
  }
  return evaluation(rule, 'PASS', `${label} satisfies the source-backed threshold.`);
}

function evaluateRule(rule: EligibilityRule, profile: CandidateEligibilityProfile): RuleEvaluation {
  switch (rule.kind) {
    case 'nationality':
      if (!profile.nationalityCodes?.length) return missing(rule);
      return codesIntersect(profile.nationalityCodes, rule.allowedCodes!)
        ? evaluation(rule, 'PASS', 'Declared nationality satisfies the source-backed rule.')
        : evaluation(rule, 'FAIL', 'Declared nationality conflicts with the source-backed rule.');

    case 'age':
      return compareNumeric(rule, profile.age, 'Declared age');

    case 'education':
      if (!profile.highestEducationLevel) return missing(rule);
      return EDUCATION_RANK[profile.highestEducationLevel] >= EDUCATION_RANK[rule.minimumEducationLevel!]
        ? evaluation(rule, 'PASS', 'Declared education level satisfies the source-backed minimum.')
        : evaluation(rule, 'FAIL', 'Declared education level is below the source-backed minimum.');

    case 'experience':
      return compareNumeric(rule, profile.yearsExperience, 'Declared experience');

    case 'language':
      if (!profile.languageCodes?.length) return missing(rule);
      return codesIntersect(profile.languageCodes, rule.allowedCodes!)
        ? evaluation(rule, 'PASS', 'Declared language evidence satisfies the source-backed rule.')
        : evaluation(rule, 'FAIL', 'Declared languages do not satisfy the source-backed rule.');

    case 'sponsor':
      if (!profile.sponsorCountryCode) return missing(rule);
      return codesIntersect([profile.sponsorCountryCode], rule.allowedCodes!)
        ? evaluation(rule, 'PASS', 'Declared sponsor country satisfies the source-backed rule.')
        : evaluation(rule, 'FAIL', 'Declared sponsor country conflicts with the source-backed rule.');

    case 'country_participation':
      if (!profile.participatingCountryCodes?.length) return missing(rule);
      return profile.participatingCountryCodes.map(normalizeCode).includes(normalizeCode(rule.requiredCode!))
        ? evaluation(rule, 'PASS', 'Current-cycle country participation is confirmed by explicit input.')
        : evaluation(rule, 'FAIL', 'Required current-cycle country participation is not present.');

    case 'post_graduation_window':
      return compareNumeric(rule, profile.monthsSinceGraduation, 'Post-graduation window');

    case 'residency':
      if (!profile.residenceCountryCode) return missing(rule);
      return codesIntersect([profile.residenceCountryCode], rule.allowedCodes!)
        ? evaluation(rule, 'PASS', 'Declared residence satisfies the source-backed rule.')
        : evaluation(rule, 'FAIL', 'Declared residence conflicts with the source-backed rule.');

    case 'document':
      if (!profile.availableDocumentCodes?.length) return missing(rule);
      return profile.availableDocumentCodes.map(normalizeCode).includes(normalizeCode(rule.requiredDocumentCode!))
        ? evaluation(rule, 'PASS', 'Required document is explicitly available.')
        : evaluation(rule, 'FAIL', 'Required document is not explicitly available.');
  }
}

export function evaluatePathwayEligibility(
  pathway: InstitutionalPathway,
  profile: CandidateEligibilityProfile,
): PathwayEligibilityResult {
  validatePathway(pathway);
  const rules = pathway.hardRules.map((rule) => evaluateRule(rule, profile));
  if (rules.some((rule) => rule.status === 'FAIL')) return { status: 'INELIGIBLE', rules };
  if (rules.some((rule) => rule.status === 'REVIEW_REQUIRED')) return { status: 'REVIEW_REQUIRED', rules };
  return { status: 'ELIGIBLE', rules };
}

export function recommendInstitutionalPathway(
  pathway: InstitutionalPathway,
  profile: CandidateEligibilityProfile,
  fitScore: number,
): InstitutionalPathwayRecommendation {
  validateFitScore(fitScore);
  const eligibility = evaluatePathwayEligibility(pathway, profile);
  let recommendation: PathwayRecommendation;

  if (eligibility.status === 'INELIGIBLE' || pathway.state === 'CLOSED') {
    recommendation = 'SKIP';
  } else if (pathway.state === 'VERIFIED_OPEN' && eligibility.status === 'ELIGIBLE') {
    recommendation = 'APPLY';
  } else {
    recommendation = 'PREPARE';
  }

  return {
    pathwayId: pathway.id,
    pathwayTitle: pathway.title,
    programmeState: pathway.state,
    fitScore,
    eligibility,
    recommendation,
  };
}

export function rankInstitutionalPathways(
  rows: InstitutionalPathwayRecommendation[],
): InstitutionalPathwayRecommendation[] {
  return [...rows].sort((a, b) => {
    const recommendationDelta = PRIORITY[a.recommendation] - PRIORITY[b.recommendation];
    if (recommendationDelta !== 0) return recommendationDelta;
    const fitDelta = b.fitScore - a.fitScore;
    if (fitDelta !== 0) return fitDelta;
    return a.pathwayId.localeCompare(b.pathwayId);
  });
}
