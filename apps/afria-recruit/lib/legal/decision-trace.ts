import { createHash } from 'node:crypto';
import type { DecisionTrace, LegalRegime, LegalVerdict } from './types.js';

export interface DecisionTraceSourceRef {
  sourceId: string;
  article: string;
}

export interface DecisionTraceRuleRef {
  ruleId: string;
  version: string;
}

export interface BuildDecisionTraceInput {
  countryCode: string;
  jurisdiction: LegalRegime;
  sources: DecisionTraceSourceRef[];
  rules: DecisionTraceRuleRef[];
  factsUsed: string[];
  missingFacts: string[];
  conflicts: string[];
  verdict: LegalVerdict;
  reviewPath?: string;
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
    );
  }
  return value;
}

function traceWithoutHash(trace: DecisionTrace): Omit<DecisionTrace, 'auditHash'> {
  const { auditHash: _auditHash, ...rest } = trace;
  return rest;
}

export function hashDecisionTrace(trace: DecisionTrace): string {
  const canonical = JSON.stringify(canonicalize(traceWithoutHash(trace)));
  return createHash('sha256').update(canonical).digest('hex');
}

export function buildDecisionTrace(input: BuildDecisionTraceInput): DecisionTrace {
  const exactSources = input.sources.map((source) => ({
    sourceId: source.sourceId.trim(),
    article: source.article.trim(),
  }));
  const exactRules = input.rules.map((rule) => ({
    ruleId: rule.ruleId.trim(),
    version: rule.version.trim(),
  }));

  if (input.verdict === 'FAIL') {
    if (input.factsUsed.length === 0) throw new Error('Adverse FAIL trace requires facts used');
    if (exactSources.length === 0 || exactSources.some((source) => !source.sourceId)) {
      throw new Error('Adverse FAIL trace requires exact source provenance');
    }
    if (exactSources.some((source) => !source.article)) {
      throw new Error('Adverse FAIL trace requires exact article provenance');
    }
    if (exactRules.length === 0 || exactRules.some((rule) => !rule.ruleId || !rule.version)) {
      throw new Error('Adverse FAIL trace requires rule identifiers and versions');
    }
    if (!input.reviewPath?.trim()) {
      throw new Error('Adverse FAIL trace requires reviewPath');
    }
  }

  const trace: DecisionTrace = {
    countryCode: input.countryCode.trim().toUpperCase(),
    jurisdiction: input.jurisdiction,
    sourceIds: sortUnique(exactSources.map((source) => source.sourceId)),
    articles: sortUnique(exactSources.map((source) => source.article)),
    ruleIds: sortUnique(exactRules.map((rule) => rule.ruleId)),
    ruleVersions: sortUnique(exactRules.map((rule) => rule.version)),
    factsUsed: sortUnique(input.factsUsed),
    missingFacts: sortUnique(input.missingFacts),
    conflicts: sortUnique(input.conflicts),
    verdict: input.verdict,
    reviewPath: input.reviewPath?.trim() || undefined,
  };

  trace.auditHash = hashDecisionTrace(trace);
  return trace;
}
