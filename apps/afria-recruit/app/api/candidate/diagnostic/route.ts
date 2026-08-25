import { createCandidateRoute } from '@/lib/http/errors';
import { createCandidateRuntime } from '@/lib/services/runtime';

export const POST = createCandidateRoute(async (request) => {
  const { auth, service } = await createCandidateRuntime(request);
  return Response.json(await service.diagnose(auth.candidate.id));
});
