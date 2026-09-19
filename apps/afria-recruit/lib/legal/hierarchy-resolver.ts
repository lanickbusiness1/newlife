import type { CountryLegalPack, LegalNormLevel, LegalRegime, LegalSource } from './types.js';

export interface ApplicableJurisdiction {
  regime: LegalRegime;
  subject: string;
}

export interface ApplicableSourceResolution {
  status: 'RESOLVED' | 'REVIEW_REQUIRED';
  sources: LegalSource[];
  conflicts: string[];
}

const NORM_PRIORITY: Record<LegalNormLevel, number> = {
  constitution: 100,
  treaty: 95,
  special_statute: 90,
  statute: 80,
  ordinance: 80,
  decree: 60,
  order: 50,
  collective_agreement: 40,
  other: 0,
};

function isEffectiveOn(source: LegalSource, effectiveDate: string): boolean {
  if (source.effectiveStatus !== 'VERIFIED') return false;
  if (source.effectiveFrom && source.effectiveFrom > effectiveDate) return false;
  if (source.effectiveTo && source.effectiveTo < effectiveDate) return false;
  return true;
}

function appliesToJurisdiction(source: LegalSource, jurisdiction: ApplicableJurisdiction): boolean {
  if (!source.regimes?.includes(jurisdiction.regime)) return false;
  return !source.subjects || source.subjects.length === 0 || source.subjects.includes(jurisdiction.subject);
}

function sourcePriority(source: LegalSource): number {
  const specificity = source.specificity === 'special' ? 1_000 : 0;
  const norm = source.normLevel ? NORM_PRIORITY[source.normLevel] : 0;
  return specificity + norm;
}

function findConflicts(sources: LegalSource[]): string[] {
  const ids = new Set(sources.map((source) => source.id));
  const conflicts = new Set<string>();

  for (const source of sources) {
    for (const otherId of source.conflictsWith ?? []) {
      if (!ids.has(otherId)) continue;
      const pair = [source.id, otherId].sort().join(' <-> ');
      conflicts.add(pair);
    }
  }

  return [...conflicts].sort();
}

export function resolveApplicableSources(
  jurisdiction: ApplicableJurisdiction,
  effectiveDate: string,
  pack: CountryLegalPack,
  regionalLayers: LegalSource[],
): ApplicableSourceResolution {
  const sources = [...pack.sources, ...regionalLayers]
    .filter((source) => isEffectiveOn(source, effectiveDate))
    .filter((source) => appliesToJurisdiction(source, jurisdiction))
    .sort((left, right) => sourcePriority(right) - sourcePriority(left) || left.id.localeCompare(right.id));

  if (sources.length === 0) {
    return {
      status: 'REVIEW_REQUIRED',
      sources: [],
      conflicts: ['NO_APPLICABLE_VERIFIED_SOURCE'],
    };
  }

  const conflicts = findConflicts(sources);
  return {
    status: conflicts.length > 0 ? 'REVIEW_REQUIRED' : 'RESOLVED',
    sources,
    conflicts,
  };
}
