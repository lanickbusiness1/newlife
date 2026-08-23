import type { CountryLegalPack } from './types.js';
import { assertCountryLegalPack } from './types.js';
import { ML_LEGAL_PACK_V0_1 } from './packs/ml.v0.1.js';

type CountryPackFactory = () => CountryLegalPack;
type VersionRegistry = Record<string, CountryPackFactory>;

const COUNTRY_PACK_REGISTRY: Record<string, VersionRegistry> = {
  ML: {
    '0.1.0': () => structuredClone(ML_LEGAL_PACK_V0_1),
  },
};

function normalizeCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

export function listCountryPackVersions(countryCode: string): string[] {
  const normalized = normalizeCountryCode(countryCode);
  return Object.keys(COUNTRY_PACK_REGISTRY[normalized] ?? {}).sort();
}

export function loadCountryLegalPack(countryCode: string, version?: string): CountryLegalPack {
  const normalized = normalizeCountryCode(countryCode);
  const versions = COUNTRY_PACK_REGISTRY[normalized];
  if (!versions) {
    throw new Error(`Country Legal Pack not registered for ${normalized}`);
  }

  const selectedVersion = version ?? Object.keys(versions).sort().at(-1);
  if (!selectedVersion || !versions[selectedVersion]) {
    throw new Error(`Country Legal Pack ${normalized} version ${version ?? 'latest'} is not registered`);
  }

  return assertCountryLegalPack(versions[selectedVersion]());
}
