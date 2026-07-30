import { QUESTIONS } from './questions.js';

export const DISCLAIMER = 'Le PI-SPI Readiness Checker™ est un outil indépendant de diagnostic et de préparation. Il ne constitue ni un agrément, ni une certification de la BCEAO, ni une confirmation de participation ou de connexion à PI-SPI.';

export function buildReport(session) {
  if (!session.score) throw new Error('Diagnostic must be scored before report generation');
  const answers = new Map(session.answers.map((answer) => [answer.question_id, answer]));
  const criticalRisks = QUESTIONS
    .filter((question) => question.is_critical)
    .filter((question) => !answers.has(question.id) || ['NON', 'NON_RENSEIGNE'].includes(answers.get(question.id).value))
    .map((question) => ({ question_id: question.id, block_id: question.block_id, reason: answers.get(question.id)?.value ?? 'MANQUANTE' }));

  return {
    report_version: 'DIAG30-v2.1',
    generated_at: new Date().toISOString(),
    diagnostic_id: session.id,
    disclaimer: DISCLAIMER,
    score: session.score,
    critical_risks: criticalRisks,
    unanswered: session.score.unanswered_questions,
    missing: session.score.missing_questions,
    answers: QUESTIONS.map((question) => ({
      question_id: question.id,
      block_id: question.block_id,
      is_critical: question.is_critical,
      value: answers.get(question.id)?.value ?? 'MANQUANTE',
      evidence_level: answers.get(question.id)?.evidence_level ?? null,
      evidence_reference: answers.get(question.id)?.evidence_reference ?? null,
      comment: answers.get(question.id)?.comment ?? null
    })),
    next_step: session.score.positive_verdict_allowed
      ? 'Confronter le résultat déclaratif aux preuves dans l’audit probant ES-12.'
      : 'Compléter les réponses et fermer les risques critiques avant toute conclusion positive.'
  };
}
