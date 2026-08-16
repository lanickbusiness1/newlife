import { createAdminClient as createLiveAdminClient } from '../supabase/admin-client.js';
import { createPublicClient, createUserTokenClient } from '../supabase/user-client.js';
import { CandidateHttpError } from '../http/errors.js';
import { readAccessTokenFromRequest } from './session-cookie.js';

export interface AuthenticatedUser {
  id: string;
}

export interface OwnedCandidate {
  id: string;
  userId: string;
}

export interface AuthBoundaryDependencies<TAdmin = unknown> {
  getUser(accessToken: string): Promise<AuthenticatedUser | null>;
  findCandidateForUser(accessToken: string, userId: string): Promise<OwnedCandidate | null>;
  createAdminClient(): TAdmin;
}

export function createLiveAuthBoundaryDependencies(): AuthBoundaryDependencies {
  return {
    async getUser(accessToken) {
      const client = createPublicClient();
      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data.user) return null;
      return { id: data.user.id };
    },
    async findCandidateForUser(accessToken, userId) {
      const client = createUserTokenClient(accessToken);
      const { data, error } = await client
        .from('candidates')
        .select('id,user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error || !data) return null;
      return { id: data.id, userId: data.user_id };
    },
    createAdminClient: () => createLiveAdminClient(),
  };
}

export async function requireAuthenticatedCandidate<TAdmin = unknown>(
  request: Request,
  dependencies: AuthBoundaryDependencies<TAdmin> = createLiveAuthBoundaryDependencies() as AuthBoundaryDependencies<TAdmin>,
) {
  const accessToken = readAccessTokenFromRequest(request);
  if (!accessToken) throw new CandidateHttpError(401, 'Authentication required');

  const user = await dependencies.getUser(accessToken);
  if (!user) throw new CandidateHttpError(401, 'Authentication required');

  const candidate = await dependencies.findCandidateForUser(accessToken, user.id);
  if (!candidate || candidate.userId !== user.id) throw new CandidateHttpError(403, 'Candidate profile required');

  // Privilege elevation is deliberately last. No service-role client exists before
  // the caller and candidate ownership have both been proven through the user path.
  const adminClient = dependencies.createAdminClient();
  return { accessToken, user, candidate, adminClient };
}
