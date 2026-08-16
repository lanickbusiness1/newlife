import { CandidateHttpError, createCandidateRoute, readJsonObject, requiredString } from '@/lib/http/errors';
import { createCandidateRuntime } from '@/lib/services/runtime';

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
  const { auth, service } = await createCandidateRuntime(request);
  return Response.json(await service.rewrite(auth.candidate.id, jobId, sourceRef, sourceStatement, verifiedMetrics, true));
});
