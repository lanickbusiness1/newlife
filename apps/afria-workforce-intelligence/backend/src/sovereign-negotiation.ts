export type TruthClass = "FACT" | "HYPOTHESIS" | "SIMULATION";
export type LegalClauseStatus = "ADVISORY_EXTRACTED" | "HUMAN_VALIDATED" | "REJECTED";
export type CorridorNodeType = "MINE" | "RAIL" | "ROAD" | "PORT_TERMINAL" | "BERTH" | "WAREHOUSE" | "MARKET";
export type NationalInterestDecision = "GO" | "HOLD" | "NO_GO" | "INSUFFICIENT_EVIDENCE";

export class EvidenceArtifact {
  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly projectId: string,
    readonly source: string,
    readonly sha256: string,
    readonly observedAt: string,
    readonly truthClass: TruthClass,
  ) {
    assertRequired(id, "Evidence id");
    assertRequired(tenantId, "Evidence tenant");
    assertRequired(projectId, "Evidence project");
    assertRequired(source, "Evidence source");
    if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error("Evidence requires a valid SHA-256 fingerprint");
    if (Number.isNaN(Date.parse(observedAt))) throw new Error("Evidence observedAt timestamp is invalid");
  }
}

abstract class SovereignObject {
  readonly evidence: readonly EvidenceArtifact[];

  constructor(
    readonly id: string,
    readonly tenantId: string,
    readonly projectId: string,
    evidence: readonly EvidenceArtifact[],
  ) {
    assertRequired(id, "Object id");
    assertRequired(tenantId, "Object tenant");
    assertRequired(projectId, "Object project");
    for (const item of evidence) {
      if (item.tenantId !== tenantId) throw new Error("Evidence tenant isolation violation");
      if (item.projectId !== projectId) throw new Error("Evidence project isolation violation");
    }
    this.evidence = Object.freeze([...evidence]);
  }
}

export class Concession extends SovereignObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly name: string,
    readonly operatorId: string,
    readonly effectiveFrom: string,
    readonly effectiveTo: string,
    evidence: readonly EvidenceArtifact[],
  ) {
    super(id, tenantId, projectId, evidence);
    assertRequired(name, "Concession name");
    assertRequired(operatorId, "Concession operator");
    assertDate(effectiveFrom, "Concession effective date");
    assertDate(effectiveTo, "Concession end date");
    if (effectiveTo < effectiveFrom) throw new Error("Concession end date cannot precede effective date");
  }
}

export class ContractClause extends SovereignObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly concessionId: string,
    readonly clauseType: string,
    readonly text: string,
    readonly legalStatus: LegalClauseStatus,
    evidence: readonly EvidenceArtifact[],
  ) {
    super(id, tenantId, projectId, evidence);
    assertRequired(concessionId, "Clause concession id");
    assertRequired(clauseType, "Clause type");
    assertRequired(text, "Clause text");
    if (evidence.length === 0) throw new Error("Contract clause requires source evidence");
  }
}

export class CorridorNode extends SovereignObject {
  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    readonly nodeType: CorridorNodeType,
    readonly name: string,
    readonly operatorId: string,
    readonly dependencyRatio: number,
    evidence: readonly EvidenceArtifact[],
  ) {
    super(id, tenantId, projectId, evidence);
    assertRequired(name, "Corridor node name");
    assertRequired(operatorId, "Corridor node operator");
    assertRatio(dependencyRatio, "Corridor dependency ratio");
  }
}

export type NationalInterestWeights = Readonly<{
  nationalValueCapture: number;
  fiscalFx: number;
  infrastructureSpillover: number;
  industrialization: number;
  localContentSkills: number;
  logisticsControl: number;
  concentrationDependency: number;
  debtGuarantees: number;
  esgCommunity: number;
  dataGovernance: number;
  reversibility: number;
  longTermResilience: number;
}>;

export type NationalInterestScores = Readonly<Record<keyof NationalInterestWeights, number>>;

export class NationalInterestAssessment extends SovereignObject {
  readonly weights: NationalInterestWeights;

  constructor(
    id: string,
    tenantId: string,
    projectId: string,
    weights: NationalInterestWeights,
    evidence: readonly EvidenceArtifact[],
  ) {
    super(id, tenantId, projectId, evidence);
    validateWeights(weights);
    this.weights = Object.freeze({ ...weights });
  }
}

export type NationalInterestResult = Readonly<{
  assessmentId: string;
  weightedScore: number | null;
  decision: NationalInterestDecision;
  eliminatoryRedFlags: readonly string[];
  evidenceCoverage: number;
}>;

export function scoreNationalInterest(input: {
  tenantId: string;
  projectId: string;
  assessmentId: string;
  weights: NationalInterestWeights;
  scores: NationalInterestScores;
  eliminatoryRedFlags: readonly string[];
  evidence: readonly EvidenceArtifact[];
}): NationalInterestResult {
  const assessment = new NationalInterestAssessment(
    input.assessmentId,
    input.tenantId,
    input.projectId,
    input.weights,
    input.evidence,
  );

  if (assessment.evidence.length === 0) {
    return Object.freeze({
      assessmentId: assessment.id,
      weightedScore: null,
      decision: "INSUFFICIENT_EVIDENCE",
      eliminatoryRedFlags: Object.freeze([...input.eliminatoryRedFlags]),
      evidenceCoverage: 0,
    });
  }

  let weighted = 0;
  for (const key of Object.keys(input.weights) as (keyof NationalInterestWeights)[]) {
    const score = input.scores[key];
    assertScore(score, `Score ${key}`);
    weighted += score * (input.weights[key] / 100);
  }

  const weightedScore = round2(weighted);
  const redFlags = Object.freeze([...input.eliminatoryRedFlags]);
  const decision: NationalInterestDecision = redFlags.length > 0 ? "NO_GO" : weightedScore >= 75 ? "GO" : weightedScore >= 55 ? "HOLD" : "NO_GO";

  return Object.freeze({
    assessmentId: assessment.id,
    weightedScore,
    decision,
    eliminatoryRedFlags: redFlags,
    evidenceCoverage: 1,
  });
}

export type SovereignScenario = Readonly<{
  id: string;
  sovereignNpv: number;
  fiscalTake: number;
  fxRetention: number;
  localValueCapture: number;
  dependencyScore: number;
}>;

export function compareSovereignScenarios(scenarios: readonly SovereignScenario[]): readonly SovereignScenario[] {
  for (const scenario of scenarios) {
    assertRequired(scenario.id, "Scenario id");
    assertFinite(scenario.sovereignNpv, "Scenario sovereign NPV");
    assertFinite(scenario.fiscalTake, "Scenario fiscal take");
    assertRatio(scenario.fxRetention, "Scenario FX retention");
    assertRatio(scenario.localValueCapture, "Scenario local value capture");
    assertRatio(scenario.dependencyScore, "Scenario dependency score");
  }

  return Object.freeze([...scenarios].sort((a, b) => b.sovereignNpv - a.sovereignNpv || a.dependencyScore - b.dependencyScore || a.id.localeCompare(b.id)));
}

function validateWeights(weights: NationalInterestWeights): void {
  let total = 0;
  for (const [key, value] of Object.entries(weights)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Weight ${key} must be between 0 and 100`);
    total += value;
  }
  if (Math.abs(total - 100) > 1e-9) throw new Error("National Interest weights must total 100");
}

function assertScore(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${label} must be between 0 and 100`);
}

function assertRatio(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function assertRequired(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}

function assertDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error(`${label} must be a valid ISO date`);
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
