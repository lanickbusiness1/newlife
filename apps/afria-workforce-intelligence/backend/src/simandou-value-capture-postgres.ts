import type { Pool, PoolClient } from "pg";
import { ControlError } from "./living-core.js";
import {
  OreLot,
  ValueCaptureComponent,
  type EconomicValueBucket,
  type EvidenceLink,
  type TruthClass,
} from "./simandou-value-capture.js";

export type ReconciliationExceptionState = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

export type StoredReconciliationException = Readonly<{
  id: string;
  tenantId: string;
  projectId: string;
  shipmentId: string | null;
  code: string;
  message: string;
  sourceObjectIds: readonly string[];
  evidenceIds: readonly string[];
  state: ReconciliationExceptionState;
}>;

type OreLotRow = Readonly<{
  id: string;
  tenant_id: string;
  project_id: string;
  tonnage: string | number;
  grade_fe_percent: string | number;
  extracted_at: string | Date;
  truth_class: TruthClass;
  evidence_refs: EvidenceLink[];
  version: number;
}>;

type ValueComponentRow = Readonly<{
  id: string;
  tenant_id: string;
  project_id: string;
  bucket: EconomicValueBucket;
  amount: string | number;
  currency: string;
  source_transaction_id: string;
  truth_class: TruthClass;
  evidence_refs: EvidenceLink[];
  version: number;
}>;

type ReconciliationExceptionRow = Readonly<{
  id: string;
  tenant_id: string;
  project_id: string;
  shipment_id: string | null;
  code: string;
  message: string;
  source_object_ids: string[];
  evidence_ids: string[];
  state: ReconciliationExceptionState;
}>;

export class PostgresSimandouRepository {
  constructor(private readonly pool: Pool) {}

  async saveOreLot(lot: OreLot): Promise<OreLot> {
    return this.withTenant(lot.tenantId, async (client) => {
      await client.query(
        `insert into simandou_ore_lots (
           id, tenant_id, project_id, external_id, tonnage, grade_fe_percent,
           extracted_at, truth_class, evidence_refs, version
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
        [
          lot.id,
          lot.tenantId,
          lot.projectId,
          lot.id,
          lot.tonnage,
          lot.gradeFePercent,
          lot.extractedAt,
          truthClassOf(lot.evidence),
          JSON.stringify(lot.evidence),
          lot.version,
        ],
      );
      return lot;
    });
  }

  async getOreLot(tenantId: string, projectId: string, lotId: string): Promise<OreLot | undefined> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query<OreLotRow>(
        `select id, tenant_id, project_id, tonnage, grade_fe_percent, extracted_at,
                truth_class, evidence_refs, version
         from simandou_ore_lots
         where tenant_id = $1 and project_id = $2 and id = $3`,
        [tenantId, projectId, lotId],
      );
      const row = result.rows[0];
      return row ? mapOreLot(row) : undefined;
    });
  }

  async replaceOreLot(lot: OreLot, expectedVersion: number): Promise<OreLot> {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new Error("Expected version must be a positive integer");
    }
    if (lot.version !== expectedVersion + 1) {
      throw new ControlError("Optimistic version conflict");
    }

    return this.withTenant(lot.tenantId, async (client) => {
      const result = await client.query(
        `update simandou_ore_lots
         set tonnage = $4,
             grade_fe_percent = $5,
             extracted_at = $6,
             truth_class = $7,
             evidence_refs = $8::jsonb,
             version = $9
         where id = $1 and tenant_id = $2 and project_id = $3 and version = $10`,
        [
          lot.id,
          lot.tenantId,
          lot.projectId,
          lot.tonnage,
          lot.gradeFePercent,
          lot.extractedAt,
          truthClassOf(lot.evidence),
          JSON.stringify(lot.evidence),
          lot.version,
          expectedVersion,
        ],
      );
      if (result.rowCount !== 1) throw new ControlError("Optimistic version conflict");
      return lot;
    });
  }

  async saveValueCaptureComponent(component: ValueCaptureComponent): Promise<ValueCaptureComponent> {
    try {
      return await this.withTenant(component.tenantId, async (client) => {
        await client.query(
          `insert into simandou_value_capture_components (
             id, tenant_id, project_id, bucket, amount, currency,
             source_transaction_id, truth_class, evidence_refs, version
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
          [
            component.id,
            component.tenantId,
            component.projectId,
            component.bucket,
            component.amount,
            component.currency,
            component.sourceTransactionId,
            component.truthClass,
            JSON.stringify(component.evidence),
            component.version,
          ],
        );
        return component;
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ControlError("Economic double counting detected for source transaction");
      }
      if (error instanceof ControlError) throw error;
      throw new ControlError("Unable to persist value capture component");
    }
  }

  async listValueCaptureComponents(tenantId: string, projectId: string): Promise<readonly ValueCaptureComponent[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = await client.query<ValueComponentRow>(
        `select id, tenant_id, project_id, bucket, amount, currency,
                source_transaction_id, truth_class, evidence_refs, version
         from simandou_value_capture_components
         where tenant_id = $1 and project_id = $2
         order by created_at, id`,
        [tenantId, projectId],
      );
      return Object.freeze(result.rows.map(mapValueComponent));
    });
  }

  async saveReconciliationException(exception: StoredReconciliationException): Promise<StoredReconciliationException> {
    if (exception.sourceObjectIds.length === 0) {
      throw new Error("Reconciliation exception requires at least one source object");
    }
    return this.withTenant(exception.tenantId, async (client) => {
      await client.query(
        `insert into simandou_reconciliation_exceptions (
           id, tenant_id, project_id, shipment_id, code, message,
           source_object_ids, evidence_ids, state
         ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
        [
          exception.id,
          exception.tenantId,
          exception.projectId,
          exception.shipmentId,
          exception.code,
          exception.message,
          JSON.stringify(exception.sourceObjectIds),
          JSON.stringify(exception.evidenceIds),
          exception.state,
        ],
      );
      return exception;
    });
  }

  async listReconciliationExceptions(
    tenantId: string,
    projectId: string,
    state?: ReconciliationExceptionState,
  ): Promise<readonly StoredReconciliationException[]> {
    return this.withTenant(tenantId, async (client) => {
      const result = state === undefined
        ? await client.query<ReconciliationExceptionRow>(
            `select id, tenant_id, project_id, shipment_id, code, message,
                    source_object_ids, evidence_ids, state
             from simandou_reconciliation_exceptions
             where tenant_id = $1 and project_id = $2
             order by created_at, id`,
            [tenantId, projectId],
          )
        : await client.query<ReconciliationExceptionRow>(
            `select id, tenant_id, project_id, shipment_id, code, message,
                    source_object_ids, evidence_ids, state
             from simandou_reconciliation_exceptions
             where tenant_id = $1 and project_id = $2 and state = $3
             order by created_at, id`,
            [tenantId, projectId, state],
          );
      return Object.freeze(result.rows.map(mapReconciliationException));
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
        // The original failure remains authoritative; rollback failure is intentionally not exposed.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function mapOreLot(row: OreLotRow): OreLot {
  return new OreLot(
    row.id,
    row.tenant_id,
    row.project_id,
    Number(row.tonnage),
    Number(row.grade_fe_percent),
    isoDate(row.extracted_at),
    row.evidence_refs,
    row.version,
  );
}

function mapValueComponent(row: ValueComponentRow): ValueCaptureComponent {
  return new ValueCaptureComponent(
    row.id,
    row.tenant_id,
    row.project_id,
    row.bucket,
    Number(row.amount),
    row.currency,
    row.source_transaction_id,
    row.evidence_refs,
    row.truth_class,
    row.version,
  );
}

function mapReconciliationException(row: ReconciliationExceptionRow): StoredReconciliationException {
  return Object.freeze({
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    shipmentId: row.shipment_id,
    code: row.code,
    message: row.message,
    sourceObjectIds: Object.freeze([...row.source_object_ids]),
    evidenceIds: Object.freeze([...row.evidence_ids]),
    state: row.state,
  });
}

function truthClassOf(evidence: readonly EvidenceLink[]): TruthClass {
  return evidence[0]?.truthClass ?? "FACT";
}

function isoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505";
}
