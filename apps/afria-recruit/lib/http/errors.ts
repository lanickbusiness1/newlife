export class CandidateHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'CandidateHttpError';
  }
}

export type CandidateRouteHandler = (request: Request) => Promise<Response>;

export function createCandidateRoute(handler: CandidateRouteHandler): CandidateRouteHandler {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof CandidateHttpError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      return Response.json({ error: 'Request failed safely' }, { status: 500 });
    }
  };
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new CandidateHttpError(400, 'Invalid JSON body');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CandidateHttpError(400, 'Invalid request');
  return value as Record<string, unknown>;
}

export function requiredString(value: unknown, label: string, max = 4000): string {
  if (typeof value !== 'string' || !value.trim()) throw new CandidateHttpError(400, `Invalid ${label}`);
  if (value.length > max) throw new CandidateHttpError(400, `Invalid ${label}`);
  return value.trim();
}
