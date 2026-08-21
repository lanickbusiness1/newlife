import {
  DecisionRecord,
  type DecisionAuthority,
  type EvidenceArtifact,
  type NationalInterestDecision,
  type NationalInterestScores,
  type NationalInterestWeights,
  type OperatorConcentration,
  type OperatorExposure,
  type SovereignScenario,
  type SovereignScenarioRecord,
  compareSovereignScenarios,
  computeOperatorConcentration,
  scoreNationalInterest,
} from "./sovereign-negotiation.js";

export type SovereignAssessmentSnapshot = Readonly<{
  assessmentId: string;
  tenantId: string;
  projectId: string;
  methodologyVersion: string;
  weights: NationalInterestWeights;
  scores: NationalInterestScores;
  weightedScore: number | null;
  decision: NationalInterestDecision;
  eliminatoryRedFlags: readonly string[];
  evidenceCoverage: number;
  evidenceIds: readonly string[];
}>;

export type SovereignNegotiationEvaluation = Readonly<{
  assessment: SovereignAssessmentSnapshot;
  concentration: OperatorConcentration;
  rankedScenarios: readonly SovereignScenario[];
}>;

export interface SovereignNegotiationRepository {
  saveAssessment(snapshot: SovereignAssessmentSnapshot): Promise<SovereignAssessmentSnapshot>;
  saveDecision<T extends DecisionRecord>(decision: T): Promise<T>;
}

export class SovereignNegotiationService {
  constructor(private readonly repository: SovereignNegotiationRepository) {}

  async evaluateOffer(input: {
    tenantId: string;
    projectId: string;
    assessmentId: string;
    methodologyVersion: string;
    weights: NationalInterestWeights;
    scores: NationalInterestScores;
    eliminatoryRedFlags: readonly string[];
    evidence: readonly EvidenceArtifact[];
    operatorExposures: readonly OperatorExposure[];
    scenarios: readonly SovereignScenarioRecord[];
  }): Promise<SovereignNegotiationEvaluation> {
    assertRequired(input.methodologyVersion, "National Interest methodology version");
    validateScope(input.tenantId, input.projectId, input.operatorExposures, "Operator exposure");
    validateScope(input.tenantId, input.projectId, input.scenarios, "Scenario");

    const result = scoreNationalInterest({
      tenantId: input.tenantId,
      projectId: input.projectId,
      assessmentId: input.assessmentId,
      weights: input.weights,
      scores: input.scores,
      eliminatoryRedFlags: input.eliminatoryRedFlags,
      evidence: input.evidence,
    });

    const assessment = Object.freeze({
      assessmentId: result.assessmentId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      methodologyVersion: input.methodologyVersion,
      weights: Object.freeze({ ...input.weights }),
      scores: Object.freeze({ ...input.scores }),
      weightedScore: result.weightedScore,
      decision: result.decision,
      eliminatoryRedFlags: Object.freeze([...result.eliminatoryRedFlags]),
      evidenceCoverage: result.evidenceCoverage,
      evidenceIds: Object.freeze(input.evidence.map((item) => item.id)),
    }) satisfies SovereignAssessmentSnapshot;

    const persistedAssessment = await this.repository.saveAssessment(assessment);
    const concentration = computeOperatorConcentration(input.operatorExposures);
    const rankedScenarios = compareSovereignScenarios(input.scenarios);

    return Object.freeze({
      assessment: persistedAssessment,
      concentration,
      rankedScenarios,
    });
  }

  async recordSovereignDecision(input: {
    id: string;
    tenantId: string;
    projectId: string;
    assessmentId: string;
    finalDecision: NationalInterestDecision;
    rationale: string;
    authority: DecisionAuthority;
    evidence: readonly EvidenceArtifact[];
  }): Promise<DecisionRecord> {
    const decision = new DecisionRecord(
      input.id,
      input.tenantId,
      input.projectId,
      input.assessmentId,
      input.finalDecision,
      input.rationale,
      input.authority,
      input.evidence,
    );
    return this.repository.saveDecision(decision);
  }
}

function validateScope(
  tenantId: string,
  projectId: string,
  objects: readonly { tenantId: string; projectId: string }[],
  label: string,
): void {
  for (const item of objects) {
    if (item.tenantId !== tenantId) throw new Error(`${label} tenant isolation violation`);
    if (item.projectId !== projectId) throw new Error(`${label} project isolation violation`);
  }
}

function assertRequired(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required`);
}
