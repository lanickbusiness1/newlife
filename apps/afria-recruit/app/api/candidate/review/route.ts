import { CandidateHttpError, createCandidateRoute, readJsonObject, requiredString } from '@/lib/http/errors';
import { createCandidateRuntime } from '@/lib/services/runtime';

export const POST = createCandidateRoute(async (request) => {
  const body = await readJsonObject(request);
  const decisionId = requiredString(body.decisionId, 'decisionId', 100);
  const rationale = requiredString(body.rationale, 'rationale', 2000);
  if (body.outcome !== 'approved' && body.outcome !== 'rejected') throw new CandidateHttpError(400, 'Invalid outcome');
  const { auth, service } = await createCandidateRuntime(request);
  return Response.json(await service.review(auth.candidate.id, auth.user.id, decisionId, body.outcome, rationale));
});
