import type { CountryLegalPack, LegalRegime } from './types.js';

export interface JurisdictionContext {
  employerType: 'private' | 'state' | 'territorial_authority' | string;
  subject: string;
}

export interface JurisdictionResolution {
  countryCode: string;
  regime: LegalRegime;
  subject: string;
  basis: string[];
}

const EMPLOYER_TYPE_TO_REGIME: Record<string, LegalRegime> = {
  private: 'private_employment',
  state: 'state_public_service',
  territorial_authority: 'territorial_public_service',
};

export function resolveJurisdiction(
  context: JurisdictionContext,
  pack: CountryLegalPack,
): JurisdictionResolution {
  const employerType = context.employerType.trim().toLowerCase();
  const regime = EMPLOYER_TYPE_TO_REGIME[employerType];

  if (!regime) {
    throw new Error(`Unsupported employer type for jurisdiction resolution: ${context.employerType}`);
  }
  if (!pack.legalRegimes.includes(regime)) {
    throw new Error(`Jurisdiction ${regime} is not declared in Country Legal Pack ${pack.countryCode}@${pack.version}`);
  }

  return {
    countryCode: pack.countryCode,
    regime,
    subject: context.subject,
    basis: [`employerType:${employerType}`, `pack:${pack.countryCode}@${pack.version}`],
  };
}
