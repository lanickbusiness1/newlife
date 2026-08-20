import { createCandidateRoute } from '@/lib/http/errors';
import { createCandidateRuntime } from '@/lib/services/runtime';

export const GET = createCandidateRoute(async (request) => {
  const { service } = await createCandidateRuntime(request);
  return Response.json({ jobs: await service.listJobs() });
});
