import {
  DecisionRecord,
  type DecisionAuthority,
  type EvidenceArtifact,
  type NationalInterestDecision,
  type NationalInterestMethodology,
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
  methodologyId: string;
  methodologyVersion: string;
  goThreshold: number;
  holdThreshold: number;
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
  saveEvidence(evidence: EvidenceArtifact): Promise<EvidenceArtifact>;
  saveMethodology(methodology: NationalInterestMethodology): Promise<NationalInterestMethodology>;
  saveAssessment(snapshot: SovereignAssessmentSnapshot): Promise<SovereignAssessmentSnapshot>;
  saveDecision<T extends DecisionRecord>(decision: T): Promise<T>;
}

export class SovereignNegotiationService {
  constructor(private readonly repository: SovereignNegotiationRepository) {}

  async evaluateOffer(input: {
    tenantId: string;
    projectId: string;
    assessmentId: string;
    methodology: NationalInterestMethodology;
    scores: NationalInterestScores;
    eliminatoryRedFlags: readonly string[];
    evidence: readonly EvidenceArtifact[];
    operatorExposures: readonly OperatorExposure[];
    scenarios: readonly SovereignScenarioRecord[];
  }): Promise<SovereignNegotiationEvaluation> {
    assertApprovedMethodologyScope(input.methodology, input.tenantId, input.projectId);
    validateScope(input.tenantId, input.projectId, input.operatorExposures, "Operator exposure");
    validateScope(input.tenantId, input.projectId, input.scenarios, "Scenario");
    validateScope(input.tenantId, input.projectId, input.evidence, "Assessment evidence");

    const evidenceById = new Map<string, EvidenceArtifact>();
    for (const item of [...input.methodology.evidence, ...input.evidence]) evidenceById.set(item.id, item);
    for (const item of evidenceById.values()) await this.repository.saveEvidence(item);
    const persistedMethodology = await this.repository.saveMethodology(input.methodology);

    const result = scoreNationalInterest({
      tenantId: input.tenantId,
      projectId: input.projectId,
      assessmentId: input.assessmentId,
      methodology: persistedMethodology,
      scores: input.scores,
      eliminatoryRedFlags: input.eliminatoryRedFlags,
      evidence: input.evidence,
    });

    const assessment = Object.freeze({
      assessmentId: result.assessmentId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      methodologyId: persistedMethodology.id,
      methodologyVersion: persistedMethodology.methodologyVersion,
      goThreshold: persistedMethodology.goThreshold,
      holdThreshold: persistedMethodology.holdThreshold,
      weights: Object.freeze({ ...persistedMethodology.weights }),
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
    validateScope(input.tenantId, input.projectId, input.evidence, "Decision evidence");
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
    for (const item of input.evidence) await this.repository.saveEvidence(item);
    return this.repository.saveDecision(decision);
  }
}

function assertApprovedMethodologyScope(
  methodology: NationalInterestMethodology,
  tenantId: string,
  projectId: string,
): void {
  if (methodology.state !== "VALIDATED") throw new Error("National Interest methodology must be approved before evaluation");
  if (methodology.tenantId !== tenantId) throw new Error("National Interest methodology tenant isolation violation");
  if (methodology.projectId !== projectId) throw new Error("National Interest methodology project isolation violation");
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
