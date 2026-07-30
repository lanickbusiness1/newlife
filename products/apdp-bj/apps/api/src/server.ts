import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { z } from 'zod';
import { registerAuthRoutes } from './auth-routes.js';
import { registerCaseRoutes } from './case-routes.js';
import { pool } from './db.js';
import { canTransition, dossierStates, type DossierState } from '../../../packages/domain/src/workflow.js';

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'development-only-change-me-minimum-32-characters',
  sign: { issuer: 'apdp-bj', audience: 'apdp-bj-api' },
  verify: { issuer: 'apdp-bj', audience: 'apdp-bj-api' },
});

const transitionSchema = z.object({
  from: z.enum(dossierStates),
  to: z.enum(dossierStates),
  actorType: z.enum(['APPLICANT', 'APDP_INTERNAL', 'AI_AGENT']),
  humanValidated: z.boolean().default(false),
});

app.get('/health', async (_request, reply) => {
  try {
    await pool.query('select 1');
    return { service: 'apdp-bj-api', status: 'ok', database: 'ok', version: '0.2.0' };
  } catch {
    return reply.code(503).send({ service: 'apdp-bj-api', status: 'degraded', database: 'unavailable', version: '0.2.0' });
  }
});

app.post('/v1/workflow/validate-transition', async (request, reply) => {
  const parsed = transitionSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  const { from, to, actorType, humanValidated } = parsed.data;
  const finalDecision = to === 'DECIDED';
  if (finalDecision && (actorType !== 'APDP_INTERNAL' || !humanValidated)) {
    return reply.code(403).send({ allowed: false, reason: 'FINAL_DECISION_REQUIRES_VALIDATED_APDP_HUMAN' });
  }
  const allowed = canTransition(from as DossierState, to as DossierState);
  return reply.code(allowed ? 200 : 409).send({ allowed, from, to, reason: allowed ? 'TRANSITION_ALLOWED' : 'TRANSITION_FORBIDDEN' });
});

await registerAuthRoutes(app);
await registerCaseRoutes(app);

app.addHook('onClose', async () => {
  await pool.end();
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
