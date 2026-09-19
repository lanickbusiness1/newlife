import type { LegalSource } from './types.js';
import { verifyLegalSource, type LegalSourceVerificationStatus } from './source-verifier.js';

export interface LegalSourceGraph {
  sources: LegalSource[];
}

export type InstrumentEffectivity =
  | 'EFFECTIVE'
  | 'NOT_YET_EFFECTIVE'
  | 'EXPIRED'
  | 'REPEALED'
  | 'REPLACED'
  | 'CONFLICT'
  | 'INCOMPLETE'
  | 'MISSING';

export interface EffectiveInstrumentResolution {
  requestedSource: LegalSource | null;
  effectiveSource: LegalSource | null;
  effectivity: InstrumentEffectivity;
  verificationStatus: LegalSourceVerificationStatus;
  amendmentSourceIds: string[];
  relatedSourceIds: string[];
}

function activeOn(source: LegalSource, date: string): boolean {
  const verification = verifyLegalSource(source);
  if (verification.status !== 'SOURCE_VERIFIED') return false;
  if (source.effectiveFrom && source.effectiveFrom > date) return false;
  if (source.effectiveTo && source.effectiveTo < date) return false;
  return true;
}

export function resolveEffectiveInstrument(
  sourceId: string,
  date: string,
  graph: LegalSourceGraph,
): EffectiveInstrumentResolution {
  const requestedSource = graph.sources.find((source) => source.id === sourceId) ?? null;
  if (!requestedSource) {
    return {
      requestedSource: null,
      effectiveSource: null,
      effectivity: 'MISSING',
      verificationStatus: 'SOURCE_INCOMPLETE',
      amendmentSourceIds: [],
      relatedSourceIds: [],
    };
  }

  const verification = verifyLegalSource(requestedSource);
  if (verification.status === 'SOURCE_CONFLICT') {
    return {
      requestedSource,
      effectiveSource: null,
      effectivity: 'CONFLICT',
      verificationStatus: verification.status,
      amendmentSourceIds: [],
      relatedSourceIds: [],
    };
  }
  if (verification.status === 'SOURCE_INCOMPLETE') {
    return {
      requestedSource,
      effectiveSource: null,
      effectivity: 'INCOMPLETE',
      verificationStatus: verification.status,
      amendmentSourceIds: [],
      relatedSourceIds: [],
    };
  }
  if (requestedSource.effectiveFrom && requestedSource.effectiveFrom > date) {
    return {
      requestedSource,
      effectiveSource: null,
      effectivity: 'NOT_YET_EFFECTIVE',
      verificationStatus: verification.status,
      amendmentSourceIds: [],
      relatedSourceIds: [],
    };
  }
  if (requestedSource.effectiveTo && requestedSource.effectiveTo < date) {
    return {
      requestedSource,
      effectiveSource: null,
      effectivity: 'EXPIRED',
      verificationStatus: verification.status,
      amendmentSourceIds: [],
      relatedSourceIds: [],
    };
  }

  const activeRelated = graph.sources.filter((source) => source.id !== sourceId && activeOn(source, date));
  const replacements = activeRelated.filter((source) => source.replaces?.includes(sourceId));
  const repeals = activeRelated.filter((source) => source.repeals?.includes(sourceId));
  const amendments = activeRelated
    .filter((source) => source.amends?.includes(sourceId))
    .map((source) => source.id)
    .sort();

  if (replacements.length > 1 || (replacements.length > 0 && repeals.some((source) => source.id !== replacements[0]?.id))) {
    return {
      requestedSource,
      effectiveSource: null,
      effectivity: 'CONFLICT',
      verificationStatus: 'SOURCE_CONFLICT',
      amendmentSourceIds: amendments,
      relatedSourceIds: [...new Set([...replacements, ...repeals].map((source) => source.id))].sort(),
    };
  }

  if (replacements.length === 1) {
    return {
      requestedSource,
      effectiveSource: replacements[0] ?? null,
      effectivity: 'REPLACED',
      verificationStatus: 'SOURCE_VERIFIED',
      amendmentSourceIds: amendments,
      relatedSourceIds: [replacements[0]!.id],
    };
  }

  if (repeals.length > 0) {
    return {
      requestedSource,
      effectiveSource: null,
      effectivity: 'REPEALED',
      verificationStatus: 'SOURCE_VERIFIED',
      amendmentSourceIds: amendments,
      relatedSourceIds: repeals.map((source) => source.id).sort(),
    };
  }

  return {
    requestedSource,
    effectiveSource: requestedSource,
    effectivity: 'EFFECTIVE',
    verificationStatus: 'SOURCE_VERIFIED',
    amendmentSourceIds: amendments,
    relatedSourceIds: amendments,
  };
}
