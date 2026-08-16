import { createCandidateRoute } from '@/lib/http/errors';
import { createCandidateRuntime } from '@/lib/services/runtime';

export const GET = createCandidateRoute(async (request) => {
  const { auth, service } = await createCandidateRuntime(request);
  const context = await service.context(auth.candidate.id);
  return Response.json({ context });
});
