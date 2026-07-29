import Fastify from 'fastify';
import { z } from 'zod';
import { canTransition, dossierStates, type DossierState } from '../../../packages/domain/src/workflow.js';

const app = Fastify({ logger: true });

const transitionSchema = z.object({
  from: z.enum(dossierStates),
  to: z.enum(dossierStates),
  actorType: z.enum(['APPLICANT', 'APDP_INTERNAL', 'AI_AGENT']),
  humanValidated: z.boolean().default(false),
});

app.get('/health', async () => ({
  service: 'apdp-bj-api',
  status: 'ok',
  version: '0.1.0',
}));

app.post('/v1/workflow/validate-transition', async (request, reply) => {
  const parsed = transitionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'INVALID_REQUEST', details: parsed.error.flatten() });
  }

  const { from, to, actorType, humanValidated } = parsed.data;
  const finalDecision = to === 'DECIDED';

  if (finalDecision && (actorType !== 'APDP_INTERNAL' || !humanValidated)) {
    return reply.code(403).send({
      allowed: false,
      reason: 'FINAL_DECISION_REQUIRES_VALIDATED_APDP_HUMAN',
    });
  }

  const allowed = canTransition(from as DossierState, to as DossierState);
  return reply.code(allowed ? 200 : 409).send({
    allowed,
    from,
    to,
    reason: allowed ? 'TRANSITION_ALLOWED' : 'TRANSITION_FORBIDDEN',
  });
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
