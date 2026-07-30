import { createAnswer, scoreDiagnostic } from './engine.js';
import { buildReport } from './report.js';

export class DiagnosticService {
  constructor(store) {
    this.store = store;
  }

  createDiagnostic(metadata = {}) {
    return this.store.create(metadata);
  }

  async saveAnswers(id, inputAnswers) {
    if (!Array.isArray(inputAnswers)) throw new TypeError('answers must be an array');
    const normalized = inputAnswers.map((input) => createAnswer(input.question_id, input.value, input));
    const updated = await this.store.update(id, (session) => {
      const merged = new Map(session.answers.map((answer) => [answer.question_id, answer]));
      normalized.forEach((answer) => merged.set(answer.question_id, answer));
      session.answers = [...merged.values()];
      session.score = null;
      return session;
    });
    if (!updated) throw Object.assign(new Error('Diagnostic not found'), { statusCode: 404 });
    return updated;
  }

  async score(id, options = {}) {
    const updated = await this.store.update(id, (session) => {
      session.score = scoreDiagnostic(session.answers, {
        evidenceGatePassed: Boolean(options.evidence_gate_passed)
      });
      return session;
    });
    if (!updated) throw Object.assign(new Error('Diagnostic not found'), { statusCode: 404 });
    return updated.score;
  }

  async report(id) {
    const session = await this.store.get(id);
    if (!session) throw Object.assign(new Error('Diagnostic not found'), { statusCode: 404 });
    return buildReport(session);
  }

  async saveConsent(id, consent) {
    if (consent?.accepted !== true) throw Object.assign(new Error('Explicit consent is required'), { statusCode: 422 });
    const updated = await this.store.update(id, (session) => {
      session.consent = {
        accepted: true,
        purpose: String(consent.purpose ?? 'lead_follow_up'),
        captured_at: new Date().toISOString()
      };
      return session;
    });
    if (!updated) throw Object.assign(new Error('Diagnostic not found'), { statusCode: 404 });
    return updated.consent;
  }

  async requestEvidence(id, payload = {}) {
    const updated = await this.store.update(id, (session) => {
      if (!session.consent?.accepted) throw Object.assign(new Error('Consent required before evidence request'), { statusCode: 409 });
      session.evidence_request = {
        status: 'PREPARED',
        requested_at: new Date().toISOString(),
        institution_name: payload.institution_name ? String(payload.institution_name) : null,
        contact_reference: payload.contact_reference ? String(payload.contact_reference) : null
      };
      return session;
    });
    if (!updated) throw Object.assign(new Error('Diagnostic not found'), { statusCode: 404 });
    return updated.evidence_request;
  }
}
