import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { pool } from './db.js';
import { hasPermission, type AuthClaims } from './security.js';

const auditQuerySchema = z.object({
  action: z.string().min(2).max(120).optional(),
  actorType: z.enum(['APPLICANT', 'APDP_INTERNAL', 'AI_AGENT', 'SYSTEM']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

function claims(request: FastifyRequest): AuthClaims {
  return request.user as AuthClaims;
}

async function authenticate(request: FastifyRequest): Promise<void> {
  await request.jwtVerify();
}

export async function registerReportingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/statistics', { preHandler: authenticate }, async (request, reply) => {
    const actor = claims(request);
    if (!hasPermission(actor, 'STATISTICS_READ')) return reply.code(403).send({ error: 'FORBIDDEN' });

    const [summary, byStatus, byRequestType, monthly] = await Promise.all([
      pool.query(
        `select
           count(*)::int as total,
           count(*) filter (where status not in ('CLOSED','ARCHIVED'))::int as active,
           count(*) filter (where status in ('DECIDED','NOTIFIED','CLOSED','ARCHIVED'))::int as decided,
           count(*) filter (where status = 'COMPLEMENT_REQUESTED')::int as awaiting_complement,
           round(avg(extract(epoch from (decided_at - created_at)) / 3600)
             filter (where decided_at is not null)::numeric, 2) as average_decision_hours
         from dossiers`,
      ),
      pool.query(`select status, count(*)::int as count from dossiers group by status order by status`),
      pool.query(`select request_type, count(*)::int as count from dossiers group by request_type order by count desc limit 20`),
      pool.query(
        `select date_trunc('month', created_at)::date as month, count(*)::int as created
         from dossiers
         where created_at >= date_trunc('month', now()) - interval '11 months'
         group by 1 order by 1`,
      ),
    ]);

    return {
      summary: summary.rows[0],
      byStatus: byStatus.rows,
      byRequestType: byRequestType.rows,
      monthlyIntake: monthly.rows,
      generatedAt: new Date().toISOString(),
    };
  });

  app.get('/v1/audit', { preHandler: authenticate }, async (request, reply) => {
    const actor = claims(request);
    if (!hasPermission(actor, 'AUDIT_READ')) return reply.code(403).send({ error: 'FORBIDDEN' });
    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_QUERY', details: parsed.error.flatten() });

    const { action, actorType, limit, offset } = parsed.data;
    const result = await pool.query(
      `select id, actor_id, actor_type, action, resource_type, resource_id, dossier_id,
              request_id, ip_address, user_agent, evidence_hash, created_at
       from audit_log
       where ($1::text is null or action = $1)
         and ($2::text is null or actor_type = $2)
       order by created_at desc
       limit $3 offset $4`,
      [action ?? null, actorType ?? null, limit, offset],
    );
    return { items: result.rows, limit, offset };
  });
}
