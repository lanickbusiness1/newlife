export type AuthorityClass = 'A' | 'B' | 'C' | 'D';
export type LicenseStatus = 'clear' | 'restricted' | 'unknown';
export type EvidenceState =
  | 'VERIFIED_READY'
  | 'EVIDENCED_USABLE'
  | 'OBSERVED_REVIEW'
  | 'SUSPECTED_QUARANTINE';

export interface DataSourceTrustInput {
  authorityClass: AuthorityClass;
  provenance: number;
  freshness: number;
  quality: number;
  representativeness: number;
  license: number;
  sovereignty: number;
  licenseStatus: LicenseStatus;
}

export interface DataSourceTrustAssessment {
  trustScore: number;
  evidenceState: EvidenceState;
  redistributionAllowed: boolean;
  flags: string[];
}

const AUTHORITY_POINTS: Record<AuthorityClass, number> = {
  A: 25,
  B: 15,
  C: 8,
  D: 0,
};

const COMPONENT_WEIGHTS = {
  provenance: 15,
  freshness: 15,
  quality: 15,
  representativeness: 15,
  license: 5,
  sovereignty: 10,
} as const;

function assertNormalized(name: keyof typeof COMPONENT_WEIGHTS, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

function evidenceStateFor(score: number): EvidenceState {
  if (score >= 85) return 'VERIFIED_READY';
  if (score >= 70) return 'EVIDENCED_USABLE';
  if (score >= 50) return 'OBSERVED_REVIEW';
  return 'SUSPECTED_QUARANTINE';
}

export function assessDataSourceTrust(input: DataSourceTrustInput): DataSourceTrustAssessment {
  for (const name of Object.keys(COMPONENT_WEIGHTS) as Array<keyof typeof COMPONENT_WEIGHTS>) {
    assertNormalized(name, input[name]);
  }

  const trustScore = Math.round(
    AUTHORITY_POINTS[input.authorityClass]
      + input.provenance * COMPONENT_WEIGHTS.provenance
      + input.freshness * COMPONENT_WEIGHTS.freshness
      + input.quality * COMPONENT_WEIGHTS.quality
      + input.representativeness * COMPONENT_WEIGHTS.representativeness
      + input.license * COMPONENT_WEIGHTS.license
      + input.sovereignty * COMPONENT_WEIGHTS.sovereignty,
  );

  const flags: string[] = [];
  if (input.freshness <= 0.25) flags.push('STALE_OR_UNDATED');
  if (input.representativeness < 0.5) flags.push('REPRESENTATIVENESS_LIMITED');
  if (input.licenseStatus !== 'clear' || input.license === 0) {
    flags.push('LICENSE_REUSE_UNRESOLVED');
  }

  return {
    trustScore,
    evidenceState: evidenceStateFor(trustScore),
    redistributionAllowed: input.licenseStatus === 'clear' && input.license > 0,
    flags,
  };
}
