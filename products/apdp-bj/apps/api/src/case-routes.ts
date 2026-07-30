import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from './db.js';
import { canAccessDossier, hasPermission, type AuthClaims } from './security.js';

const uuid = z.string().uuid();
const createDossierSchema = z.object({ organizationId: uuid.optional(), requestType: z.string().min(3).max(120) });
const documentSchema = z.object({ name: z.string().min(1).max(255), mimeType: z.string().min(3).max(120), storageKey: z.string().min(1).max(500), sha256: z.string().regex(/^[a-f0-9]{64}$/), sizeBytes: z.number().int().positive() });
const assignmentSchema = z.object({ assignedTo: uuid, note: z.string().max(2000).optional() });
const decisionSchema = z.object({ outcome: z.enum(['APPROVED', 'APPROVED_WITH_RESERVES', 'REJECTED', 'RETURNED_FOR_COMPLEMENT']), rationale: z.string().min(20).max(20000), humanValidated: z.literal(true) });

function claims(request: FastifyRequest): AuthClaims {
  return request.user as AuthClaims;
}

async function authenticate(request: FastifyRequest): Promise<void> {
  await request.jwtVerify();
}

async function getDossier(id: string) {
  const result = await pool.query('select * from dossiers where id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function registerCaseRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/dossiers', { preHandler: authenticate }, async (request, reply) => {
    const actor = claims(request);
    if (!hasPermission(actor, 'DOSSIER_CREATE')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const parsed = createDossierSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_DOSSIER', details: parsed.error.flatten() });
    const reference = `APDP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const result = await pool.query(
      `insert into dossiers(reference, organization_id, applicant_id, request_type)
       values ($1,$2,$3,$4) returning *`,
      [reference, parsed.data.organizationId ?? null, actor.sub, parsed.data.requestType],
    );
    return reply.code(201).send(result.rows[0]);
  });

  app.get('/v1/dossiers', { preHandler: authenticate }, async (request) => {
    const actor = claims(request);
    const all = hasPermission(actor, 'DOSSIER_READ_ALL');
    const result = await pool.query(
      all ? 'select * from dossiers order by created_at desc limit 100' : 'select * from dossiers where applicant_id = $1 or assigned_to = $1 order by created_at desc limit 100',
      all ? [] : [actor.sub],
    );
    return { items: result.rows };
  });

  app.get('/v1/dossiers/:id', { preHandler: authenticate }, async (request, reply) => {
    const id = uuid.safeParse((request.params as { id: string }).id);
    if (!id.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const dossier = await getDossier(id.data);
    if (!dossier) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (!canAccessDossier(claims(request), dossier, 'read')) return reply.code(403).send({ error: 'FORBIDDEN' });
    return dossier;
  });

  app.post('/v1/dossiers/:id/documents', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    const parsed = documentSchema.safeParse(request.body);
    if (!dossierId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_DOCUMENT' });
    const dossier = await getDossier(dossierId.data);
    const actor = claims(request);
    if (!dossier) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (!hasPermission(actor, 'DOCUMENT_CREATE') || !canAccessDossier(actor, dossier, 'update')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const result = await pool.query(
      `insert into documents(dossier_id, name, mime_type, storage_key, sha256, size_bytes, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [dossierId.data, parsed.data.name, parsed.data.mimeType, parsed.data.storageKey, parsed.data.sha256, parsed.data.sizeBytes, actor.sub],
    );
    return reply.code(201).send(result.rows[0]);
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
      await client.query('update assignments set ended_at = now() where dossier_id = $1 and ended_at is null', [dossierId.data]);
      const result = await client.query(
        `insert into assignments(dossier_id, assigned_to, assigned_by, note) values ($1,$2,$3,$4) returning *`,
        [dossierId.data, parsed.data.assignedTo, actor.sub, parsed.data.note ?? null],
      );
      await client.query(`update dossiers set assigned_to = $2, status = case when status = 'ADMISSIBLE' then 'ASSIGNED' else status end, updated_at = now() where id = $1`, [dossierId.data, parsed.data.assignedTo]);
      return result.rows[0];
    });
    return assigned ? reply.code(201).send(assigned) : reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
  });

  app.post('/v1/dossiers/:id/decisions', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    const parsed = decisionSchema.safeParse(request.body);
    const actor = claims(request);
    if (!dossierId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_DECISION' });
    if (actor.actorType !== 'APDP_INTERNAL' || !hasPermission(actor, 'DECISION_VALIDATE')) return reply.code(403).send({ error: 'FINAL_DECISION_REQUIRES_AUTHORIZED_APDP_HUMAN' });
    const decision = await withTransaction(async (client) => {
      const dossier = await client.query('select * from dossiers where id = $1 for update', [dossierId.data]);
      if (!dossier.rows[0]) return null;
      if (dossier.rows[0].status !== 'DECISION_PREPARED') throw new Error('INVALID_DECISION_STATE');
      const result = await client.query(
        `insert into decisions(dossier_id, outcome, rationale, decided_by, human_validated, validated_at)
         values ($1,$2,$3,$4,true,now()) returning *`,
        [dossierId.data, parsed.data.outcome, parsed.data.rationale, actor.sub],
      );
      await client.query(`update dossiers set status = 'DECIDED', decided_at = now(), updated_at = now() where id = $1`, [dossierId.data]);
      await client.query(
        `insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
         values ($1,'DECISION_VALIDATED','DOSSIER',$2,$3::jsonb)`,
        [actor.sub, dossierId.data, JSON.stringify({ decisionId: result.rows[0].id, outcome: parsed.data.outcome })],
      );
      return result.rows[0];
    }).catch((error: Error) => error.message === 'INVALID_DECISION_STATE' ? 'INVALID_STATE' : Promise.reject(error));
    if (decision === null) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (decision === 'INVALID_STATE') return reply.code(409).send({ error: 'DOSSIER_NOT_READY_FOR_DECISION' });
    return reply.code(201).send(decision);
  });
}
