import { createAnswer, scoreDiagnostic } from './engine.js';
import { buildReport } from './report.js';

function cleanText(value, maxLength = 250) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().slice(0, maxLength);
}

export class DiagnosticService {
  constructor(store) {
    this.store = store;
  }

  createDiagnostic(metadata = {}) {
    const safeMetadata = {
      country: cleanText(metadata.country, 8),
      institution_type: cleanText(metadata.institution_type, 80),
      source: cleanText(metadata.source, 80)
    };
    return this.store.create(safeMetadata);
  }

  async saveAnswers(id, inputAnswers) {
    if (!Array.isArray(inputAnswers)) throw new TypeError('answers must be an array');
    const normalized = inputAnswers.map((input) => createAnswer(input.question_id, input.value, {
      ...input,
      evidence_reference: cleanText(input.evidence_reference, 500),
      comment: cleanText(input.comment, 1000)
    }));
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
        purpose: cleanText(consent.purpose, 120) ?? 'lead_follow_up',
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
        institution_name: cleanText(payload.institution_name, 160),
        contact_reference: cleanText(payload.contact_reference, 160)
      };
      return session;
    });
    if (!updated) throw Object.assign(new Error('Diagnostic not found'), { statusCode: 404 });
    return updated.evidence_request;
  }
}
