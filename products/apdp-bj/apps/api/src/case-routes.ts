import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool, withTransaction } from './db.js';
import { canAccessDossier, hasPermission, type AuthClaims } from './security.js';
import { dossierStates } from '../../../packages/domain/src/workflow.js';

const uuid = z.string().uuid();
const createDossierSchema = z.object({
  organizationId: uuid.optional(),
  requestType: z.string().min(3).max(120),
});
const updateDossierSchema = z.object({
  organizationId: uuid.nullable().optional(),
  requestType: z.string().min(3).max(120).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');
const listDossiersSchema = z.object({
  status: z.enum(dossierStates).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const documentSchema = z.object({
  documentType: z.string().min(2).max(120),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
  storageKey: z.string().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
});
const assignmentSchema = z.object({
  assignedTo: uuid,
  reason: z.string().max(2000).optional(),
});
const prepareDecisionSchema = z.object({
  decisionType: z.enum(['APPROVED', 'APPROVED_WITH_RESERVES', 'REJECTED', 'RETURNED_FOR_COMPLEMENT']),
  reasoning: z.string().min(20).max(20000),
  conditions: z.array(z.unknown()).max(100).default([]),
});
const validateDecisionSchema = z.object({ humanValidated: z.literal(true) });

function claims(request: FastifyRequest): AuthClaims {
  return request.user as AuthClaims;
}

async function authenticate(request: FastifyRequest): Promise<void> {
  await request.jwtVerify();
}

async function getDossier(id: string, client: PoolClient | typeof pool = pool) {
  const result = await client.query('select * from dossiers where id = $1', [id]);
  return result.rows[0] ?? null;
}

async function audit(
  client: PoolClient,
  request: FastifyRequest,
  action: string,
  resourceType: string,
  resourceId: string,
  dossierId: string | null,
  beforeData: unknown,
  afterData: unknown,
): Promise<void> {
  const actor = claims(request);
  await client.query(
    `insert into audit_log(
       actor_id, actor_type, action, resource_type, resource_id, dossier_id,
       request_id, ip_address, user_agent, before_data, after_data
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`,
    [
      actor.sub,
      actor.actorType,
      action,
      resourceType,
      resourceId,
      dossierId,
      request.id,
      request.ip,
      request.headers['user-agent'] ?? null,
      beforeData === null ? null : JSON.stringify(beforeData),
      afterData === null ? null : JSON.stringify(afterData),
    ],
  );
}

export async function registerCaseRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/dossiers', { preHandler: authenticate }, async (request, reply) => {
    const actor = claims(request);
    if (!hasPermission(actor, 'DOSSIER_CREATE')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const parsed = createDossierSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_DOSSIER', details: parsed.error.flatten() });

    const created = await withTransaction(async (client) => {
      const reference = `APDP-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const result = await client.query(
        `insert into dossiers(reference, organization_id, applicant_id, request_type)
         values ($1,$2,$3,$4) returning *`,
        [reference, parsed.data.organizationId ?? null, actor.sub, parsed.data.requestType],
      );
      await audit(client, request, 'DOSSIER_CREATED', 'DOSSIER', result.rows[0].id, result.rows[0].id, null, result.rows[0]);
      return result.rows[0];
    });
    return reply.code(201).send(created);
  });

  app.get('/v1/dossiers', { preHandler: authenticate }, async (request, reply) => {
    const parsed = listDossiersSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_QUERY', details: parsed.error.flatten() });
    const actor = claims(request);
    const all = hasPermission(actor, 'DOSSIER_READ_ALL');
    const { status, limit, offset } = parsed.data;
    const result = await pool.query(
      all
        ? `select * from dossiers
           where ($1::text is null or status = $1)
           order by created_at desc limit $2 offset $3`
        : `select * from dossiers
           where (applicant_id = $1 or assigned_to = $1)
             and ($2::text is null or status = $2)
           order by created_at desc limit $3 offset $4`,
      all ? [status ?? null, limit, offset] : [actor.sub, status ?? null, limit, offset],
    );
    return { items: result.rows, limit, offset };
  });

  app.get('/v1/dossiers/:id', { preHandler: authenticate }, async (request, reply) => {
    const id = uuid.safeParse((request.params as { id: string }).id);
    if (!id.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const dossier = await getDossier(id.data);
    if (!dossier) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (!canAccessDossier(claims(request), dossier, 'read')) return reply.code(403).send({ error: 'FORBIDDEN' });
    return dossier;
  });

  app.patch('/v1/dossiers/:id', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    const parsed = updateDossierSchema.safeParse(request.body);
    if (!dossierId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_DOSSIER_UPDATE' });
    const actor = claims(request);
    if (!hasPermission(actor, 'DOSSIER_UPDATE_OWN')) return reply.code(403).send({ error: 'FORBIDDEN' });

    const updated = await withTransaction(async (client) => {
      const before = await getDossier(dossierId.data, client);
      if (!before) return null;
      if (!canAccessDossier(actor, before, 'update')) return 'FORBIDDEN';

      const fields: string[] = [];
      const values: unknown[] = [];
      if ('organizationId' in parsed.data) {
        values.push(parsed.data.organizationId ?? null);
        fields.push(`organization_id = $${values.length}`);
      }
      if (parsed.data.requestType !== undefined) {
        values.push(parsed.data.requestType);
        fields.push(`request_type = $${values.length}`);
      }
      fields.push('version = version + 1', 'updated_at = now()');
      values.push(dossierId.data);
      const result = await client.query(
        `update dossiers set ${fields.join(', ')} where id = $${values.length} returning *`,
        values,
      );
      await audit(client, request, 'DOSSIER_UPDATED', 'DOSSIER', dossierId.data, dossierId.data, before, result.rows[0]);
      return result.rows[0];
    });

    if (updated === null) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (updated === 'FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN' });
    return updated;
  });

  app.post('/v1/dossiers/:id/documents', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    const parsed = documentSchema.safeParse(request.body);
    if (!dossierId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_DOCUMENT', details: parsed.success ? undefined : parsed.error.flatten() });
    const dossier = await getDossier(dossierId.data);
    const actor = claims(request);
    if (!dossier) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (!hasPermission(actor, 'DOCUMENT_CREATE') || !canAccessDossier(actor, dossier, 'update')) return reply.code(403).send({ error: 'FORBIDDEN' });

    const created = await withTransaction(async (client) => {
      const result = await client.query(
        `insert into documents(dossier_id, document_type, file_name, storage_key, mime_type, size_bytes, sha256, uploaded_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [dossierId.data, parsed.data.documentType, parsed.data.fileName, parsed.data.storageKey, parsed.data.mimeType, parsed.data.sizeBytes, parsed.data.sha256, actor.sub],
      );
      await audit(client, request, 'DOCUMENT_REGISTERED', 'DOCUMENT', result.rows[0].id, dossierId.data, null, result.rows[0]);
      return result.rows[0];
    });
    return reply.code(201).send(created);
  });

  app.get('/v1/dossiers/:id/documents', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    if (!dossierId.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const dossier = await getDossier(dossierId.data);
    const actor = claims(request);
    if (!dossier) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (!hasPermission(actor, 'DOCUMENT_READ') || !canAccessDossier(actor, dossier, 'read')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const result = await pool.query('select * from documents where dossier_id = $1 order by created_at desc', [dossierId.data]);
    return { items: result.rows };
  });

  app.post('/v1/dossiers/:id/assignments', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    const parsed = assignmentSchema.safeParse(request.body);
    const actor = claims(request);
    if (!dossierId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_ASSIGNMENT' });
    if (!hasPermission(actor, 'DOSSIER_ASSIGN')) return reply.code(403).send({ error: 'FORBIDDEN' });

    const assigned = await withTransaction(async (client) => {
      const dossier = await client.query('select * from dossiers where id = $1 for update', [dossierId.data]);
      if (!dossier.rows[0]) return null;
      const assignee = await client.query(
        `select id from users where id = $1 and user_type = 'APDP_INTERNAL' and is_active = true`,
        [parsed.data.assignedTo],
      );
      if (!assignee.rows[0]) return 'INVALID_ASSIGNEE';
      await client.query('update assignments set released_at = now() where dossier_id = $1 and released_at is null', [dossierId.data]);
      const result = await client.query(
        `insert into assignments(dossier_id, assigned_to, assigned_by, reason)
         values ($1,$2,$3,$4) returning *`,
        [dossierId.data, parsed.data.assignedTo, actor.sub, parsed.data.reason ?? null],
      );
      const dossierAfter = await client.query(
        `update dossiers
         set assigned_to = $2,
             status = case when status = 'ADMISSIBLE' then 'ASSIGNED' else status end,
             updated_at = now()
         where id = $1 returning *`,
        [dossierId.data, parsed.data.assignedTo],
      );
      await audit(client, request, 'DOSSIER_ASSIGNED', 'ASSIGNMENT', result.rows[0].id, dossierId.data, dossier.rows[0], dossierAfter.rows[0]);
      return result.rows[0];
    });
    if (assigned === null) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (assigned === 'INVALID_ASSIGNEE') return reply.code(400).send({ error: 'INVALID_ASSIGNEE' });
    return reply.code(201).send(assigned);
  });

  app.get('/v1/dossiers/:id/assignments', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    if (!dossierId.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const dossier = await getDossier(dossierId.data);
    const actor = claims(request);
    if (!dossier) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (!hasPermission(actor, 'ASSIGNMENT_READ') || !canAccessDossier(actor, dossier, 'read')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const result = await pool.query('select * from assignments where dossier_id = $1 order by assigned_at desc', [dossierId.data]);
    return { items: result.rows };
  });

  app.post('/v1/dossiers/:id/decisions', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    const parsed = prepareDecisionSchema.safeParse(request.body);
    const actor = claims(request);
    if (!dossierId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_DECISION_DRAFT' });
    if (actor.actorType !== 'APDP_INTERNAL' || !hasPermission(actor, 'DECISION_PREPARE')) return reply.code(403).send({ error: 'FORBIDDEN' });

    const prepared = await withTransaction(async (client) => {
      const dossier = await client.query('select * from dossiers where id = $1 for update', [dossierId.data]);
      if (!dossier.rows[0]) return null;
      if (dossier.rows[0].status !== 'PENDING_HIERARCHICAL_VALIDATION') return 'INVALID_STATE';
      const result = await client.query(
        `insert into decisions(dossier_id, decision_type, status, reasoning, conditions, prepared_by)
         values ($1,$2,'PENDING_VALIDATION',$3,$4::jsonb,$5) returning *`,
        [dossierId.data, parsed.data.decisionType, parsed.data.reasoning, JSON.stringify(parsed.data.conditions), actor.sub],
      );
      const after = await client.query(
        `update dossiers set status = 'DECISION_PREPARED', updated_at = now() where id = $1 returning *`,
        [dossierId.data],
      );
      await audit(client, request, 'DECISION_PREPARED', 'DECISION', result.rows[0].id, dossierId.data, dossier.rows[0], after.rows[0]);
      return result.rows[0];
    });
    if (prepared === null) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (prepared === 'INVALID_STATE') return reply.code(409).send({ error: 'DOSSIER_NOT_READY_FOR_DECISION_PREPARATION' });
    return reply.code(201).send(prepared);
  });

  app.post('/v1/dossiers/:id/decisions/:decisionId/validate', { preHandler: authenticate }, async (request, reply) => {
    const params = request.params as { id: string; decisionId: string };
    const dossierId = uuid.safeParse(params.id);
    const decisionId = uuid.safeParse(params.decisionId);
    const parsed = validateDecisionSchema.safeParse(request.body);
    const actor = claims(request);
    if (!dossierId.success || !decisionId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_DECISION_VALIDATION' });
    if (actor.actorType !== 'APDP_INTERNAL' || !hasPermission(actor, 'DECISION_VALIDATE')) return reply.code(403).send({ error: 'FINAL_DECISION_REQUIRES_AUTHORIZED_APDP_HUMAN' });

    const validated = await withTransaction(async (client) => {
      const dossier = await client.query('select * from dossiers where id = $1 for update', [dossierId.data]);
      if (!dossier.rows[0]) return null;
      if (dossier.rows[0].status !== 'DECISION_PREPARED') return 'INVALID_STATE';
      const decision = await client.query(
        `select * from decisions where id = $1 and dossier_id = $2 for update`,
        [decisionId.data, dossierId.data],
      );
      if (!decision.rows[0]) return 'DECISION_NOT_FOUND';
      if (decision.rows[0].status !== 'PENDING_VALIDATION') return 'DECISION_ALREADY_PROCESSED';
      const result = await client.query(
        `update decisions
         set status = 'VALIDATED', validated_by = $2, validated_at = now(), updated_at = now()
         where id = $1 returning *`,
        [decisionId.data, actor.sub],
      );
      const dossierAfter = await client.query(
        `update dossiers set status = 'DECIDED', decided_at = now(), updated_at = now() where id = $1 returning *`,
        [dossierId.data],
      );
      await audit(client, request, 'DECISION_VALIDATED', 'DECISION', decisionId.data, dossierId.data, decision.rows[0], result.rows[0]);
      await audit(client, request, 'DOSSIER_DECIDED', 'DOSSIER', dossierId.data, dossierId.data, dossier.rows[0], dossierAfter.rows[0]);
      return result.rows[0];
    });
    if (validated === null) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (validated === 'DECISION_NOT_FOUND') return reply.code(404).send({ error: 'DECISION_NOT_FOUND' });
    if (validated === 'INVALID_STATE' || validated === 'DECISION_ALREADY_PROCESSED') return reply.code(409).send({ error: validated });
    return validated;
  });

  app.get('/v1/dossiers/:id/decisions', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    if (!dossierId.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const dossier = await getDossier(dossierId.data);
    const actor = claims(request);
    if (!dossier) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (!hasPermission(actor, 'DECISION_READ') || !canAccessDossier(actor, dossier, 'read')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const result = await pool.query('select * from decisions where dossier_id = $1 order by created_at desc', [dossierId.data]);
    return { items: result.rows };
  });
}
