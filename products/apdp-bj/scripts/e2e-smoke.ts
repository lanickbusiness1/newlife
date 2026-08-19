const baseUrl = process.env.APDP_API_URL ?? 'http://127.0.0.1:3001';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface Dossier {
  id: string;
  reference: string;
  status: string;
}

async function call<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed (${response.status}): ${text}`);
  }
  return body as T;
}

async function login(email: string, password: string): Promise<LoginResponse> {
  return call<LoginResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function transition(dossierId: string, to: string, token: string): Promise<Dossier> {
  return call<Dossier>(`/v1/dossiers/${dossierId}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ to, reason: `CI transition vers ${to}` }),
  }, token);
}

const applicant = await login('applicant@ci.apdp.bj', 'Applicant-CI-Password-2026!');
const dossier = await call<Dossier>('/v1/dossiers', {
  method: 'POST',
  body: JSON.stringify({ requestType: 'AUTORISATION_TRAITEMENT_CI' }),
}, applicant.accessToken);

await call<Dossier>(`/v1/dossiers/${dossier.id}`, {
  method: 'PATCH',
  body: JSON.stringify({ requestType: 'AUTORISATION_TRAITEMENT_DONNEES_CI' }),
}, applicant.accessToken);

await call(`/v1/dossiers/${dossier.id}/documents`, {
  method: 'POST',
  body: JSON.stringify({
    documentType: 'FORMULAIRE_DEMANDE',
    fileName: 'demande-ci.pdf',
    mimeType: 'application/pdf',
    storageKey: `ci/${dossier.id}/demande-ci.pdf`,
    sha256: 'a'.repeat(64),
    sizeBytes: 2048,
  }),
}, applicant.accessToken);

await transition(dossier.id, 'SUBMITTED', applicant.accessToken);

const reception = await login('reception@ci.apdp.bj', 'Reception-CI-Password-2026!');
await transition(dossier.id, 'RECEIVED', reception.accessToken);
await transition(dossier.id, 'UNDER_COMPLETENESS_REVIEW', reception.accessToken);
await transition(dossier.id, 'ADMISSIBLE', reception.accessToken);

const supervisor = await login('supervisor@ci.apdp.bj', 'Supervisor-CI-Password-2026!');
await call(`/v1/dossiers/${dossier.id}/assignments`, {
  method: 'POST',
  body: JSON.stringify({
    assignedTo: '33333333-3333-4333-8333-333333333333',
    reason: 'Affectation automatique du scénario CI',
  }),
}, supervisor.accessToken);

const instructor = await login('instructor@ci.apdp.bj', 'Instructor-CI-Password-2026!');
await transition(dossier.id, 'UNDER_INSTRUCTION', instructor.accessToken);
await transition(dossier.id, 'UNDER_ANALYSIS', instructor.accessToken);
await transition(dossier.id, 'PENDING_HIERARCHICAL_VALIDATION', instructor.accessToken);

const decision = await call<{ id: string }>(`/v1/dossiers/${dossier.id}/decisions`, {
  method: 'POST',
  body: JSON.stringify({
    decisionType: 'APPROVED_WITH_RESERVES',
    reasoning: 'Le dossier CI satisfait les contrôles de recevabilité, de sécurité et de traçabilité requis.',
    conditions: [{ code: 'RESERVE_CI', description: 'Preuve de suivi à conserver dans le dossier.' }],
  }),
}, instructor.accessToken);

const authority = await login('authority@ci.apdp.bj', 'Authority-CI-Password-2026!');
await call(`/v1/dossiers/${dossier.id}/decisions/${decision.id}/validate`, {
  method: 'POST',
  body: JSON.stringify({ humanValidated: true }),
}, authority.accessToken);

const finalDossier = await call<Dossier>(`/v1/dossiers/${dossier.id}`, {}, authority.accessToken);
if (finalDossier.status !== 'DECIDED') {
  throw new Error(`Expected DECIDED, received ${finalDossier.status}`);
}

const statistics = await call<{ summary: { total: number } }>('/v1/statistics', {}, authority.accessToken);
if (Number(statistics.summary.total) < 1) throw new Error('Statistics did not include the CI dossier');

const audit = await call<{ items: unknown[] }>(`/v1/dossiers/${dossier.id}/audit`, {}, authority.accessToken);
if (audit.items.length < 5) throw new Error('Audit ledger is incomplete');

const events = await call<{ items: unknown[] }>(`/v1/dossiers/${dossier.id}/events`, {}, applicant.accessToken);
if (events.items.length < 5) throw new Error('Dossier event timeline is incomplete');

console.log(JSON.stringify({
  status: 'passed',
  dossierId: dossier.id,
  reference: dossier.reference,
  finalState: finalDossier.status,
  auditEntries: audit.items.length,
  events: events.items.length,
}, null, 2));
