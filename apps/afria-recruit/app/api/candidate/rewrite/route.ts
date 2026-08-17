import { CandidateHttpError, createCandidateRoute, readJsonObject, requiredString } from '@/lib/http/errors';
import type { ConfirmedFact, ConfirmedFactStatus } from '@/lib/domain/evidence-elicitation';
import { createCandidateRuntime } from '@/lib/services/runtime';

const confirmedFactStatuses = new Set<ConfirmedFactStatus>(['DECLARED', 'EVIDENCED', 'VERIFIED']);

export const POST = createCandidateRoute(async (request) => {
  const body = await readJsonObject(request);
  const sourceRef = requiredString(body.sourceRef, 'sourceRef', 200);
  const sourceStatement = requiredString(body.sourceStatement, 'sourceStatement', 4000);
  const jobId = requiredString(body.jobId, 'jobId', 100);
  if (body.consent !== true) throw new CandidateHttpError(400, 'Explicit external processing consent required');
  if (!Array.isArray(body.verifiedMetrics)) throw new CandidateHttpError(400, 'Invalid verifiedMetrics');
  const verifiedMetrics = body.verifiedMetrics.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CandidateHttpError(400, 'Invalid verifiedMetrics');
    const metric = raw as Record<string, unknown>;
    return {
      value: requiredString(metric.value, 'metric value', 300),
      sourceRef: requiredString(metric.sourceRef, 'metric sourceRef', 200),
    };
  });

  const rawConfirmedFacts = body.confirmedFacts === undefined ? [] : body.confirmedFacts;
  if (!Array.isArray(rawConfirmedFacts) || rawConfirmedFacts.length > 20) throw new CandidateHttpError(400, 'Invalid confirmedFacts');
  const confirmedFacts: ConfirmedFact[] = rawConfirmedFacts.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CandidateHttpError(400, 'Invalid confirmedFacts');
    const fact = raw as Record<string, unknown>;
    const status = requiredString(fact.status, 'confirmed fact status', 20) as ConfirmedFactStatus;
    if (!confirmedFactStatuses.has(status)) throw new CandidateHttpError(400, 'Invalid confirmed fact status');
    return {
      key: requiredString(fact.key, 'confirmed fact key', 80),
      value: requiredString(fact.value, 'confirmed fact value', 500),
      sourceRef: requiredString(fact.sourceRef, 'confirmed fact sourceRef', 200),
      status,
    };
  });

  const { auth, service } = await createCandidateRuntime(request);
  return Response.json(await service.rewrite(auth.candidate.id, jobId, sourceRef, sourceStatement, verifiedMetrics, true, confirmedFacts));
});
