import type { CandidateContext } from '../repositories/candidate-context.js';
import type { DiagnosticFinding, JobSpec, RequirementCoverage } from '../domain/types.js';
import type { RecruiterLensItem } from '../domain/recruiter-lens.js';

export type DiagnosticResponse = { decisionId: string; diagnostic: { findings: DiagnosticFinding[] } };
export type GapAnalysisResponse = {
  decisionId: string;
  jobSpec: JobSpec;
  analysis: { requirements: RequirementCoverage[] };
  recruiterLens: RecruiterLensItem[];
};
export type VariantSections = {
  headline: string | null;
  summary: string | null;
  experiences: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  languages: Array<Record<string, unknown>>;
};
export type VariantsResponse = {
  decisionId: string;
  variants: {
    factsCanonicalJson: string;
    ats: { kind: 'ATS'; factsFingerprint: string; targetJob: string; sections: VariantSections };
    human: { kind: 'HUMAN'; factsFingerprint: string; targetJob: string; sections: VariantSections };
  };
};

export class CandidateApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'CandidateApiError';
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
      ? String((body as { error: string }).error)
      : 'La demande a échoué de manière sûre.';
    throw new CandidateApiError(response.status, message);
  }
  return body as T;
}

export const candidateApi = {
  context: () => requestJson<{ context: CandidateContext }>('/api/candidate/context'),
  diagnostic: () => requestJson<DiagnosticResponse>('/api/candidate/diagnostic', { method: 'POST' }),
  jobs: () => requestJson<{ jobs: JobSpec[] }>('/api/candidate/jobs'),
  gapAnalysis: (jobId: string) => requestJson<GapAnalysisResponse>('/api/candidate/gap-analysis', { method: 'POST', body: JSON.stringify({ jobId }) }),
  rewrite: (sourceRef: string, sourceStatement: string, jobId: string, consent: boolean) => requestJson<{ decisionId: string; rewrite: { text: string; usedMetrics: string[] }; consentId: string | null }>('/api/candidate/rewrite', {
    method: 'POST',
    body: JSON.stringify({ sourceRef, sourceStatement, jobId, consent, verifiedMetrics: [] }),
  }),
  variants: (jobId: string) => requestJson<VariantsResponse>('/api/candidate/variants', { method: 'POST', body: JSON.stringify({ jobId }) }),
  review: (decisionId: string, rationale: string) => requestJson<{ reviewId: string; outcome: string }>('/api/candidate/review', { method: 'POST', body: JSON.stringify({ decisionId, rationale, outcome: 'approved' }) }),
  startInterview: (jobId: string) => requestJson<{ interviewId: string; consentId: string; turn: { question: string; feedback: string | null }; rawAnswerStored: false }>('/api/candidate/interview/start', { method: 'POST', body: JSON.stringify({ jobId, consent: true }) }),
  respondInterview: (interviewId: string, answer: string, turn: number) => requestJson<{ decisionId: string; turn: { question: string; feedback: string | null }; rawAnswerStored: false }>('/api/candidate/interview/respond', { method: 'POST', body: JSON.stringify({ interviewId, answer, turn }) }),
  createApplicationPackage: (jobId: string, variantsDecisionId: string) => requestJson<{ application: { id: string; status: string }; submitted: false; appliedAt: null }>('/api/candidate/application-package', { method: 'POST', body: JSON.stringify({ jobId, variantsDecisionId }) }),
  recordOutcome: (applicationId: string, outcome: 'interview' | 'offer' | 'hired' | 'rejected') => requestJson<{ eventId: string; confirmationStatus: 'unconfirmed'; canonicalStatus: string }>('/api/candidate/outcome', { method: 'POST', body: JSON.stringify({ applicationId, outcome }) }),
};
