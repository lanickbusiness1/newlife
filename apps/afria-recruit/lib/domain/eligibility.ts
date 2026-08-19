import type {
  CandidateEligibilityProfile,
  CareerOpportunity,
  EducationLevel,
  EligibilityResult,
  EligibilityRule,
} from './career-opportunity.js';

const SOURCE_FRESHNESS_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

const EDUCATION_ORDER: Record<EducationLevel, number> = {
  SECONDARY: 1,
  BACHELOR: 2,
  MASTER: 3,
  PHD: 4,
};

function normalized(values: string[]): string[] {
  return values.map((value) => value.trim().toUpperCase()).filter(Boolean);
}

function sourceIsFresh(verifiedAt: string, now: Date): boolean {
  const verified = Date.parse(verifiedAt);
  if (!Number.isFinite(verified)) return false;
  const ageMs = now.getTime() - verified;
  return ageMs >= 0 && ageMs <= SOURCE_FRESHNESS_DAYS * DAY_MS;
}

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value);
}

function evaluateBlockingRule(
  profile: CandidateEligibilityProfile,
  rule: EligibilityRule,
  failedRuleIds: string[],
  reviewRuleIds: string[],
  missingData: string[],
) {
  if (!rule.blocking) return;

  switch (rule.type) {
    case 'MIN_AGE':
      if (profile.age === null) pushUnique(missingData, 'age');
      else if (profile.age < rule.value) pushUnique(failedRuleIds, rule.id);
      return;
    case 'MAX_AGE':
      if (profile.age === null) pushUnique(missingData, 'age');
      else if (profile.age > rule.value) pushUnique(failedRuleIds, rule.id);
      return;
    case 'NATIONALITY_IN': {
      if (profile.nationalities.length === 0) {
        pushUnique(missingData, 'nationalities');
        return;
      }
      const allowed = normalized(rule.value);
      const candidateValues = normalized(profile.nationalities);
      if (!candidateValues.some((value) => allowed.includes(value))) pushUnique(failedRuleIds, rule.id);
      return;
    }
    case 'RESIDENCE_IN': {
      if (profile.residenceCountryCode === null || profile.residenceCountryCode.trim() === '') {
        pushUnique(missingData, 'residenceCountryCode');
        return;
      }
      const allowed = normalized(rule.value);
      if (!allowed.includes(profile.residenceCountryCode.trim().toUpperCase())) pushUnique(failedRuleIds, rule.id);
      return;
    }
    case 'LANGUAGE_IN': {
      if (profile.languageCodes.length === 0) {
        pushUnique(missingData, 'languageCodes');
        return;
      }
      const allowed = normalized(rule.value);
      const candidateValues = normalized(profile.languageCodes);
      if (!candidateValues.some((value) => allowed.includes(value))) pushUnique(failedRuleIds, rule.id);
      return;
    }
    case 'MIN_EDUCATION':
      if (profile.highestEducationLevel === null) pushUnique(missingData, 'highestEducationLevel');
      else if (EDUCATION_ORDER[profile.highestEducationLevel] < EDUCATION_ORDER[rule.value]) {
        pushUnique(failedRuleIds, rule.id);
      }
      return;
    case 'MIN_EXPERIENCE_YEARS':
      if (profile.yearsExperience === null) pushUnique(missingData, 'yearsExperience');
      else if (profile.yearsExperience < rule.value) pushUnique(failedRuleIds, rule.id);
      return;
    case 'MANUAL_REVIEW':
      pushUnique(reviewRuleIds, rule.id);
      return;
  }
}

export function evaluateEligibility(
  profile: CandidateEligibilityProfile,
  opportunity: CareerOpportunity,
  now: Date = new Date(),
): EligibilityResult {
  const failedRuleIds: string[] = [];
  const reviewRuleIds: string[] = [];
  const missingData: string[] = [];
  const sourceFresh = sourceIsFresh(opportunity.verifiedAt, now);

  for (const rule of opportunity.eligibilityRules) {
    evaluateBlockingRule(profile, rule, failedRuleIds, reviewRuleIds, missingData);
  }

  if (failedRuleIds.length > 0) {
    return { status: 'INELIGIBLE', failedRuleIds, reviewRuleIds, missingData, sourceFresh };
  }

  if (!sourceFresh || reviewRuleIds.length > 0 || missingData.length > 0) {
    return { status: 'REVIEW_REQUIRED', failedRuleIds, reviewRuleIds, missingData, sourceFresh };
  }

  return { status: 'ELIGIBLE', failedRuleIds, reviewRuleIds, missingData, sourceFresh };
}