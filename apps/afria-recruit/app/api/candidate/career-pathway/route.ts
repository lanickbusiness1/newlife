import { CandidateHttpError, createCandidateRoute } from '@/lib/http/errors';
import { createCandidateRuntime } from '@/lib/services/runtime';

export const GET = createCandidateRoute(async (request) => {
  const { auth, careerPathwayService } = await createCandidateRuntime(request);
  const url = new URL(request.url);
  const goalTitle = url.searchParams.get('goal')?.trim();
  if (!goalTitle) throw new CandidateHttpError(400, 'Career goal required');
  if (goalTitle.length > 160) throw new CandidateHttpError(400, 'Career goal too long');

  return Response.json(await careerPathwayService.rankForCandidate(auth.candidate.id, goalTitle));
});
