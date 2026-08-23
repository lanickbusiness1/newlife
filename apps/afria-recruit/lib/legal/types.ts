export type CountryReadinessStatus =
  | 'DISCOVERED'
  | 'SOURCE_MAPPED'
  | 'SOURCE_VERIFIED'
  | 'RULES_DRAFTED'
  | 'CROSS_CHECKED'
  | 'TESTED'
  | 'COUNTRY_READY';

export type LegalRegime =
  | 'private_employment'
  | 'state_public_service'
  | 'territorial_public_service'
  | 'special_regime';

export type LegalSourceEffectiveStatus =
  | 'VERIFIED'
  | 'CONFLICT'
  | 'INCOMPLETE'
  | 'REPEALED'
  | 'REPLACED'
  | 'FUTURE_EFFECTIVE';

export type LegalNormLevel =
  | 'constitution'
  | 'treaty'
  | 'special_statute'
  | 'statute'
  | 'ordinance'
  | 'decree'
  | 'order'
  | 'collective_agreement'
  | 'other';

export type LegalVerdict = 'PASS' | 'FAIL' | 'REVIEW_REQUIRED' | 'NOT_APPLICABLE';

export type LegalRuleLifecycleStatus =
  | 'DISCOVERED'
  | 'RULE_DRAFTED'
  | 'CROSS_CHECKED'
  | 'TESTED'
  | 'TECHNICALLY_VALIDATED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED';

export type LegalConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'gte'
  | 'lte'
  | 'gt'
  | 'lt'
  | 'in'
  | 'present'
  | 'absent';

export type LegalConditionValue = string | number | boolean | string[] | number[];

export interface LegalCondition {
  fact: string;
  operator: LegalConditionOperator;
  value?: LegalConditionValue;
}

export interface LegalSource {
  id: string;
  title: string;
  authority: string;
  sourceUrl: string;
  effectiveStatus: LegalSourceEffectiveStatus;
  effectiveFrom?: string;
  effectiveTo?: string;
  amends?: string[];
  repeals?: string[];
  replaces?: string[];
  regimes?: LegalRegime[];
  subjects?: string[];
  normLevel?: LegalNormLevel;
  specificity?: 'general' | 'special';
  conflictsWith?: string[];
}

export interface RegionalLayerRef {
  id: string;
  organization: string;
  subjects: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface CountryLegalPack {
  countryCode: string;
  version: string;
  integrityHash: string;
  status: CountryReadinessStatus;
  legalRegimes: LegalRegime[];
  regionalLayers: RegionalLayerRef[];
  sources: LegalSource[];
}

export interface LegalRule {
  id: string;
  countryCode: string;
  regime: LegalRegime;
  sourceId: string;
  article: string;
  version: string;
  effectiveStatus: LegalSourceEffectiveStatus;
  lifecycleStatus: LegalRuleLifecycleStatus;
  conditions: LegalCondition[];
  exceptions: LegalCondition[];
  requiredFacts: string[];
  verdicts: LegalVerdict[];
  onMatch?: LegalVerdict;
  onNoMatch?: LegalVerdict;
}

export interface DecisionTrace {
  countryCode: string;
  jurisdiction: LegalRegime;
  sourceIds: string[];
  articles: string[];
  ruleIds: string[];
  ruleVersions: string[];
  factsUsed: string[];
  missingFacts: string[];
  conflicts: string[];
  verdict: LegalVerdict;
  reviewPath?: string;
  auditHash?: string;
}

export interface LegalDecision {
  verdict: LegalVerdict;
  applicableRegime: LegalRegime;
  applicableSources: LegalSource[];
  applicableRules: LegalRule[];
  trace: DecisionTrace;
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertNonEmptyString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

const COUNTRY_STATUSES = new Set<CountryReadinessStatus>([
  'DISCOVERED',
  'SOURCE_MAPPED',
  'SOURCE_VERIFIED',
  'RULES_DRAFTED',
  'CROSS_CHECKED',
  'TESTED',
  'COUNTRY_READY',
]);

const VERDICTS = new Set<LegalVerdict>(['PASS', 'FAIL', 'REVIEW_REQUIRED', 'NOT_APPLICABLE']);

export function assertCountryLegalPack(value: unknown): CountryLegalPack {
  assertRecord(value, 'CountryLegalPack');
  assertNonEmptyString(value, 'countryCode');
  assertNonEmptyString(value, 'version');
  assertNonEmptyString(value, 'integrityHash');
  const status = assertNonEmptyString(value, 'status') as CountryReadinessStatus;
  if (!COUNTRY_STATUSES.has(status)) {
    throw new TypeError(`status is unsupported: ${status}`);
  }
  if (!Array.isArray(value.legalRegimes)) {
    throw new TypeError('legalRegimes must be an array');
  }
  if (!Array.isArray(value.regionalLayers)) {
    throw new TypeError('regionalLayers must be an array');
  }
  if (!Array.isArray(value.sources)) {
    throw new TypeError('sources must be an array');
  }
  for (const source of value.sources) {
    assertRecord(source, 'LegalSource');
    assertNonEmptyString(source, 'id');
    assertNonEmptyString(source, 'title');
    assertNonEmptyString(source, 'authority');
    assertNonEmptyString(source, 'sourceUrl');
    assertNonEmptyString(source, 'effectiveStatus');
  }
  return value as unknown as CountryLegalPack;
}

export function assertLegalRule(value: unknown): LegalRule {
  assertRecord(value, 'LegalRule');
  assertNonEmptyString(value, 'id');
  assertNonEmptyString(value, 'countryCode');
  assertNonEmptyString(value, 'regime');
  assertNonEmptyString(value, 'sourceId');
  assertNonEmptyString(value, 'article');
  assertNonEmptyString(value, 'version');
  assertNonEmptyString(value, 'effectiveStatus');
  assertNonEmptyString(value, 'lifecycleStatus');
  if (!Array.isArray(value.conditions)) {
    throw new TypeError('conditions must be an array');
  }
  if (!Array.isArray(value.exceptions)) {
    throw new TypeError('exceptions must be an array');
  }
  if (!Array.isArray(value.requiredFacts)) {
    throw new TypeError('requiredFacts must be an array');
  }
  if (!Array.isArray(value.verdicts) || value.verdicts.some((verdict) => typeof verdict !== 'string' || !VERDICTS.has(verdict as LegalVerdict))) {
    throw new TypeError('verdict contains an unsupported value');
  }
  return value as unknown as LegalRule;
}
