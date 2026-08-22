import type { Pool, PoolClient } from "pg";
import {
  DecisionRecord,
  EvidenceArtifact,
  NationalInterestMethodology,
  type NationalInterestDecision,
  type NationalInterestMethodologyState,
  type NationalInterestScores,
  type NationalInterestWeights,
  type TruthClass,
} from "./sovereign-negotiation.js";
import type {
  SovereignAssessmentSnapshot,
  SovereignNegotiationRepository,
} from "./sovereign-negotiation-service.js";

type EvidenceRow = Readonly<{
  id: string;
  tenant_id: string;
  project_id: string;
  source_uri: string;
  sha256: string;
  observed_at: string | Date;
  truth_class: TruthClass;
}>;

type MethodologyRow = Readonly<{
  id: string;
  tenant_id: string;
  project_id: string;
  methodology_version: string;
  weights: NationalInterestWeights;
  go_threshold: string | number;
  hold_threshold: string | number;
  state: NationalInterestMethodologyState;
  validated_by_identity_id: string | null;
  validated_at: string | Date | null;
  evidence_ids: string[];
  version: number;
}>;

type AssessmentRow = Readonly<{
  id: string;
  tenant_id: string;
  project_id: string;
  methodology_id: string;
  methodology_version: string;
  go_threshold: string | number;
  hold_threshold: string | number;
  weights: NationalInterestWeights;
  scores: NationalInterestScores;
  weighted_score: string | number | null;
  decision: NationalInterestDecision;
  eliminatory_red_flags: string[];
  evidence_count: number;
  evidence_ids: string[];
}>;

type DecisionRow = Readonly<{
  id: string;
  tenant_id: string;
  project_id: string;
  assessment_id: string;
  decision: NationalInterestDecision;
  rationale: string;
  decided_by_identity_id: string;
  evidence_ids: string[];
}>;

export class PostgresSovereignNegotiationRepository implements SovereignNegotiationRepository {
  constructor(private readonly pool: Pool) {}

  async saveEvidence(evidence: EvidenceArtifact): Promise<EvidenceArtifact> {
    return this.withTenant(evidence.tenantId, async (client) => {
      await client.query(
        `insert into sovereign_evidence_artifacts (
           id, tenant_id, project_id, external_id, source_uri, sha256, observed_at, truth_class
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (id) do nothing`,
        [
          evidence.id,
          evidence.tenantId,
          evidence.projectId,
          evidence.id,
          evidence.source,
          evidence.sha256,
          evidence.observedAt,
          evidence.truthClass,
        ],
      );
      const persisted = await getEvidenceWithClient(client, evidence.tenantId, evidence.projectId, evidence.id);
      if (!persisted || !sameEvidence(persisted, evidence)) {
        throw new Error("Sovereign evidence identity conflict");
      }
      return persisted;
    });
  }

  async getEvidence(tenantId: string, projectId: string, evidenceId: string): Promise<EvidenceArtifact | undefined> {
    return this.withTenant(tenantId, (client) => getEvidenceWithClient(client, tenantId, projectId, evidenceId));
  }

  async saveMethodology(methodology: NationalInterestMethodology): Promise<NationalInterestMethodology> {
    if (methodology.state !== "VALIDATED") throw new Error("Only approved National Interest methodology can be persisted for scoring");
    const weightTotal = Object.values(methodology.weights).reduce((sum, weight) => sum + weight, 0);
    return this.withTenant(methodology.tenantId, async (client) => {
      await client.query(
        `insert into sovereign_national_interest_methodologies (
           id, tenant_id, project_id, external_id, methodology_version,
           weights, weight_total, go_threshold, hold_threshold, state,
           validated_by_identity_id, validated_at, evidence_ids, version
         ) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (id) do nothing`,
        [
          methodology.id,
          methodology.tenantId,
          methodology.projectId,
          methodology.id,
          methodology.methodologyVersion,
          JSON.stringify(methodology.weights),
          weightTotal,
          methodology.goThreshold,
          methodology.holdThreshold,
          methodology.state,
          methodology.validatedByIdentityId,
          methodology.validatedAt,
          methodology.evidence.map((item) => item.id),
          methodology.version,
        ],
      );
      const persisted = await getMethodologyWithClient(client, methodology.tenantId, methodology.projectId, methodology.id);
      if (!persisted || !sameMethodology(persisted, methodology)) {
        throw new Error("National Interest methodology identity conflict");
      }
      return persisted;
    });
  }

  async getMethodology(
    tenantId: string,
    projectId: string,
    methodologyId: string,
  ): Promise<NationalInterestMethodology | undefined> {
    return this.withTenant(tenantId, (client) => getMethodologyWithClient(client, tenantId, projectId, methodologyId));
  }

  async saveAssessment(snapshot: SovereignAssessmentSnapshot): Promise<SovereignAssessmentSnapshot> {
    const weightTotal = Object.values(snapshot.weights).reduce((sum, weight) => sum + weight, 0);
    return this.withTenant(snapshot.tenantId, async (client) => {
      await client.query(
        `insert into sovereign_national_interest_assessments (
           id, tenant_id, project_id, external_id, methodology_id, methodology_version,
           weights, weight_total, scores, weighted_score, decision,
           eliminatory_red_flags, evidence_count, evidence_ids
         ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,$14)`,
        [
          snapshot.assessmentId,
          snapshot.tenantId,
          snapshot.projectId,
          snapshot.assessmentId,
          snapshot.methodologyId,
          snapshot.methodologyVersion,
          JSON.stringify(snapshot.weights),
          weightTotal,
          JSON.stringify(snapshot.scores),
          snapshot.weightedScore,
          snapshot.decision,
          [...snapshot.eliminatoryRedFlags],
          snapshot.evidenceIds.length,
          [...snapshot.evidenceIds],
        ],
      );
      return snapshot;
    });
  }

  async getAssessment(
    tenantId: string,
    projectId: string,
    assessmentId: string,
  ): Promise<SovereignAssessmentSnapshot | undefined> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query<AssessmentRow>(
        `select assessment.id, assessment.tenant_id, assessment.project_id,
                assessment.methodology_id, assessment.methodology_version,
                methodology.go_threshold, methodology.hold_threshold,
                assessment.weights, assessment.scores, assessment.weighted_score,
                assessment.decision, assessment.eliminatory_red_flags,
                assessment.evidence_count, assessment.evidence_ids
         from sovereign_national_interest_assessments assessment
         join sovereign_national_interest_methodologies methodology
           on methodology.id = assessment.methodology_id
          and methodology.tenant_id = assessment.tenant_id
          and methodology.project_id = assessment.project_id
         where assessment.tenant_id = $1 and assessment.project_id = $2 and assessment.id = $3`,
        [tenantId, projectId, assessmentId],
      );
      const row = result.rows[0];
      return row ? mapAssessment(row) : undefined;
    });
  }

  async saveDecision<T extends DecisionRecord>(decision: T): Promise<T> {
    return this.withTenant(decision.tenantId, async (client) => {
      await client.query(
        `insert into sovereign_decision_records (
           id, tenant_id, project_id, external_id, assessment_id,
           decision, rationale, decided_by_identity_id, evidence_ids
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          decision.id,
          decision.tenantId,
          decision.projectId,
          decision.id,
          decision.assessmentId,
          decision.decision,
          decision.rationale,
          decision.decidedBy.id,
          decision.evidence.map((item) => item.id),
        ],
      );
      return decision;
    });
  }

  async getDecision(tenantId: string, projectId: string, decisionId: string): Promise<DecisionRecord | undefined> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query<DecisionRow>(
        `select id, tenant_id, project_id, assessment_id, decision, rationale,
                decided_by_identity_id, evidence_ids
         from sovereign_decision_records
         where tenant_id = $1 and project_id = $2 and id = $3`,
        [tenantId, projectId, decisionId],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const evidence = await loadEvidence(client, tenantId, projectId, row.evidence_ids);
      return new DecisionRecord(
        row.id,
        row.tenant_id,
        row.project_id,
        row.assessment_id,
        row.decision,
        row.rationale,
        { id: row.decided_by_identity_id, kind: "HUMAN" },
        evidence,
      );
    });
  }

  private async withTenant<T>(tenantId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!tenantId.trim()) throw new Error("Tenant id is required");
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await operation(client);
      await client.query("commit");
      return result;
    } catch (error: unknown) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the authoritative failure from the operation.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

async function getEvidenceWithClient(
  client: PoolClient,
  tenantId: string,
  projectId: string,
  evidenceId: string,
): Promise<EvidenceArtifact | undefined> {
  const result = await client.query<EvidenceRow>(
    `select id, tenant_id, project_id, source_uri, sha256, observed_at, truth_class
     from sovereign_evidence_artifacts
     where tenant_id = $1 and project_id = $2 and id = $3`,
    [tenantId, projectId, evidenceId],
  );
  const row = result.rows[0];
  return row ? mapEvidence(row) : undefined;
}

async function getMethodologyWithClient(
  client: PoolClient,
  tenantId: string,
  projectId: string,
  methodologyId: string,
): Promise<NationalInterestMethodology | undefined> {
  const result = await client.query<MethodologyRow>(
    `select id, tenant_id, project_id, methodology_version, weights,
            go_threshold, hold_threshold, state, validated_by_identity_id,
            validated_at, evidence_ids, version
     from sovereign_national_interest_methodologies
     where tenant_id = $1 and project_id = $2 and id = $3`,
    [tenantId, projectId, methodologyId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const evidence = await loadEvidence(client, tenantId, projectId, row.evidence_ids);
  return new NationalInterestMethodology(
    row.id,
    row.tenant_id,
    row.project_id,
    row.methodology_version,
    row.weights,
    Number(row.go_threshold),
    Number(row.hold_threshold),
    row.state,
    evidence,
    row.version,
    row.validated_by_identity_id,
    row.validated_at === null ? null : toIso(row.validated_at),
  );
}

async function loadEvidence(
  client: PoolClient,
  tenantId: string,
  projectId: string,
  evidenceIds: readonly string[],
): Promise<readonly EvidenceArtifact[]> {
  if (evidenceIds.length === 0) return Object.freeze([]);
  const result = await client.query<EvidenceRow>(
    `select id, tenant_id, project_id, source_uri, sha256, observed_at, truth_class
     from sovereign_evidence_artifacts
     where tenant_id = $1 and project_id = $2 and id = any($3::uuid[])`,
    [tenantId, projectId, [...evidenceIds]],
  );
  const byId = new Map(result.rows.map((row) => [row.id, mapEvidence(row)]));
  const ordered = evidenceIds.map((id) => byId.get(id));
  if (ordered.some((item) => item === undefined)) {
    throw new Error("Persisted sovereign object has incomplete evidence lineage");
  }
  return Object.freeze(ordered as EvidenceArtifact[]);
}

function mapEvidence(row: EvidenceRow): EvidenceArtifact {
  return new EvidenceArtifact(
    row.id,
    row.tenant_id,
    row.project_id,
    row.source_uri,
    row.sha256,
    toIso(row.observed_at),
    row.truth_class,
  );
}

function mapAssessment(row: AssessmentRow): SovereignAssessmentSnapshot {
  return Object.freeze({
    assessmentId: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    methodologyId: row.methodology_id,
    methodologyVersion: row.methodology_version,
    goThreshold: Number(row.go_threshold),
    holdThreshold: Number(row.hold_threshold),
    weights: Object.freeze({ ...row.weights }),
    scores: Object.freeze({ ...row.scores }),
    weightedScore: row.weighted_score === null ? null : Number(row.weighted_score),
    decision: row.decision,
    eliminatoryRedFlags: Object.freeze([...row.eliminatory_red_flags]),
    evidenceCoverage: row.evidence_count > 0 ? 1 : 0,
    evidenceIds: Object.freeze([...row.evidence_ids]),
  });
}

function sameEvidence(left: EvidenceArtifact, right: EvidenceArtifact): boolean {
  return left.id === right.id
    && left.tenantId === right.tenantId
    && left.projectId === right.projectId
    && left.source === right.source
    && left.sha256 === right.sha256
    && left.observedAt === right.observedAt
    && left.truthClass === right.truthClass;
}

function sameMethodology(left: NationalInterestMethodology, right: NationalInterestMethodology): boolean {
  return left.id === right.id
    && left.tenantId === right.tenantId
    && left.projectId === right.projectId
    && left.methodologyVersion === right.methodologyVersion
    && JSON.stringify(left.weights) === JSON.stringify(right.weights)
    && left.goThreshold === right.goThreshold
    && left.holdThreshold === right.holdThreshold
    && left.state === right.state
    && left.version === right.version
    && left.validatedByIdentityId === right.validatedByIdentityId
    && left.validatedAt === right.validatedAt
    && JSON.stringify(left.evidence.map((item) => item.id)) === JSON.stringify(right.evidence.map((item) => item.id));
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
