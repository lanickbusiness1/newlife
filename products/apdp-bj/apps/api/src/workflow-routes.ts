import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from './db.js';
import { canAccessDossier, hasPermission, type AuthClaims } from './security.js';
import { canTransition, dossierStates, type DossierState } from '../../../packages/domain/src/workflow.js';

const uuid = z.string().uuid();
const transitionSchema = z.object({
  to: z.enum(dossierStates),
  reason: z.string().min(3).max(4000).optional(),
});

function claims(request: FastifyRequest): AuthClaims {
  return request.user as AuthClaims;
}

async function authenticate(request: FastifyRequest): Promise<void> {
  await request.jwtVerify();
}

function applicantTransitionAllowed(from: DossierState, to: DossierState): boolean {
  return (from === 'DRAFT' && to === 'SUBMITTED')
    || (from === 'COMPLEMENT_REQUESTED' && to === 'UNDER_COMPLETENESS_REVIEW');
}

export async function registerWorkflowRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/dossiers/:id/transitions', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    const parsed = transitionSchema.safeParse(request.body);
    if (!dossierId.success || !parsed.success) return reply.code(400).send({ error: 'INVALID_TRANSITION_REQUEST' });

    const actor = claims(request);
    const outcome = await withTransaction(async (client) => {
      const result = await client.query('select * from dossiers where id = $1 for update', [dossierId.data]);
      const dossier = result.rows[0];
      if (!dossier) return 'NOT_FOUND';

      const from = dossier.status as DossierState;
      const to = parsed.data.to as DossierState;
      if (!canTransition(from, to)) return 'INVALID_TRANSITION';
      if (['ASSIGNED', 'DECISION_PREPARED', 'DECIDED'].includes(to)) return 'SPECIALIZED_ENDPOINT_REQUIRED';

      if (actor.actorType === 'APPLICANT') {
        if (dossier.applicant_id !== actor.sub || !applicantTransitionAllowed(from, to)) return 'FORBIDDEN';
      } else {
        if (!hasPermission(actor, 'DOSSIER_TRANSITION')) return 'FORBIDDEN';
        const earlyReceptionState = ['SUBMITTED', 'RECEIVED', 'UNDER_COMPLETENESS_REVIEW', 'INCOMPLETE', 'ADMISSIBLE'].includes(from);
        const receptionAuthorized = actor.roles.includes('RECEPTION_OFFICER') && earlyReceptionState;
        if (!receptionAuthorized && !canAccessDossier(actor, dossier, 'update')) return 'FORBIDDEN';
      }

      const updated = await client.query(
        `update dossiers
         set status = $2,
             submitted_at = case when $2 = 'SUBMITTED' then coalesce(submitted_at, now()) else submitted_at end,
             version = version + 1,
             updated_at = now()
         where id = $1 returning *`,
        [dossierId.data, to],
      );
      await client.query(
        `insert into dossier_events(dossier_id, actor_id, event_type, from_status, to_status, payload)
         values ($1,$2,'STATUS_TRANSITION',$3,$4,$5::jsonb)`,
        [dossierId.data, actor.sub, from, to, JSON.stringify({ reason: parsed.data.reason ?? null })],
      );
      await client.query(
        `insert into audit_log(
           actor_id, actor_type, action, resource_type, resource_id, dossier_id,
           request_id, ip_address, user_agent, before_data, after_data
         ) values ($1,$2,'DOSSIER_STATUS_CHANGED','DOSSIER',$3,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,
        [
          actor.sub,
          actor.actorType,
          dossierId.data,
          request.id,
          request.ip,
          request.headers['user-agent'] ?? null,
          JSON.stringify(dossier),
          JSON.stringify(updated.rows[0]),
        ],
      );
      return updated.rows[0];
    });

    if (outcome === 'NOT_FOUND') return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (outcome === 'FORBIDDEN') return reply.code(403).send({ error: 'FORBIDDEN' });
    if (outcome === 'INVALID_TRANSITION') return reply.code(409).send({ error: 'TRANSITION_FORBIDDEN_BY_STATE_MACHINE' });
    if (outcome === 'SPECIALIZED_ENDPOINT_REQUIRED') return reply.code(409).send({ error: 'SPECIALIZED_ENDPOINT_REQUIRED' });
    return outcome;
  });

  app.get('/v1/dossiers/:id/events', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    if (!dossierId.success) return reply.code(400).send({ error: 'INVALID_ID' });
    const dossierResult = await pool.query('select * from dossiers where id = $1', [dossierId.data]);
    const dossier = dossierResult.rows[0];
    if (!dossier) return reply.code(404).send({ error: 'DOSSIER_NOT_FOUND' });
    if (!canAccessDossier(claims(request), dossier, 'read')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const result = await pool.query(
      `select id, event_type, from_status, to_status, payload, created_at
       from dossier_events where dossier_id = $1 order by created_at asc`,
      [dossierId.data],
    );
    return { items: result.rows };
  });

  app.get('/v1/dossiers/:id/audit', { preHandler: authenticate }, async (request, reply) => {
    const dossierId = uuid.safeParse((request.params as { id: string }).id);
    const actor = claims(request);
    if (!dossierId.success) return reply.code(400).send({ error: 'INVALID_ID' });
    if (!hasPermission(actor, 'AUDIT_READ')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const result = await pool.query(
      `select id, actor_id, actor_type, action, resource_type, resource_id,
              request_id, before_data, after_data, evidence_hash, created_at
       from audit_log where dossier_id = $1 order by created_at desc limit 500`,
      [dossierId.data],
    );
    return { items: result.rows };
  });
}
