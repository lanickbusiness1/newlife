import { createCandidateRoute, readJsonObject, requiredString } from '@/lib/http/errors';
import { createCandidateRuntime } from '@/lib/services/runtime';

export const POST = createCandidateRoute(async (request) => {
  const body = await readJsonObject(request);
  const jobId = requiredString(body.jobId, 'jobId', 100);
  const { auth, service } = await createCandidateRuntime(request);
  return Response.json(await service.applicationReadiness(auth.candidate.id, jobId));
});
