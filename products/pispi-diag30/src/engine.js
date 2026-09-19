import { ANSWER_VALUES, QUESTION_INDEX, QUESTIONS, STATUS } from './questions.js';

const STATUS_NAMES = Object.freeze(Object.fromEntries(Object.entries(STATUS).map(([name, rank]) => [rank, name])));
const ECONOMIC_CRITICALS = new Set(['I1', 'I2', 'I4']);

function assertAnswer(answer) {
  if (!answer || typeof answer !== 'object') throw new TypeError('Each answer must be an object');
  if (!QUESTION_INDEX[answer.question_id]) throw new RangeError(`Unknown question_id: ${answer.question_id}`);
  if (!(answer.value in ANSWER_VALUES)) throw new RangeError(`Invalid answer value for ${answer.question_id}: ${answer.value}`);
}

function scoreToStatus(score) {
  if (score < 40) return STATUS.NOT_READY;
  if (score < 60) return STATUS.HIGH_RISK;
  if (score < 75) return STATUS.CONDITIONALLY_READY;
  if (score < 90) return STATUS.READY_WITH_CONTROLS;
  return STATUS.STRATEGICALLY_READY;
}

function capStatus(current, maximum) {
  return Math.min(current, maximum);
}

function normalize(points, maximum) {
  return Math.round((points / maximum) * 100);
}

function componentScore(answerMap, ids) {
  const points = ids.reduce((sum, id) => sum + (ANSWER_VALUES[answerMap.get(id)?.value] ?? 0), 0);
  return normalize(points, ids.length * 4);
}

export function calculateAess(answerMap) {
  const components = {
    tco: componentScore(answerMap, ['I1']),
    unit_economics: componentScore(answerMap, ['I2']),
    revenue_model: componentScore(answerMap, ['I3']),
    value_sharing: componentScore(answerMap, ['I4']),
    adoption: componentScore(answerMap, ['I5']),
  };

  const score = Math.round(
    0.25 * components.tco +
    0.25 * components.unit_economics +
    0.20 * components.revenue_model +
    0.15 * components.value_sharing +
    0.15 * components.adoption,
  );

  return { score, components };
}

export function scoreDiagnostic(answers, { evidenceGatePassed = false } = {}) {
  if (!Array.isArray(answers)) throw new TypeError('answers must be an array');
  answers.forEach(assertAnswer);

  const answerMap = new Map();
  for (const answer of answers) {
    if (answerMap.has(answer.question_id)) throw new Error(`Duplicate answer: ${answer.question_id}`);
    answerMap.set(answer.question_id, answer);
  }

  const missingQuestions = QUESTIONS.filter((question) => !answerMap.has(question.id)).map((question) => question.id);
  const unansweredQuestions = QUESTIONS.filter((question) => answerMap.get(question.id)?.value === 'NON_RENSEIGNE').map((question) => question.id);
  const criticalUnanswered = QUESTIONS.filter((question) => question.critical && (!answerMap.has(question.id) || answerMap.get(question.id)?.value === 'NON_RENSEIGNE')).map((question) => question.id);
  const criticalFailures = QUESTIONS.filter((question) => question.critical && answerMap.get(question.id)?.value === 'NON').map((question) => question.id);

  const rawScore = QUESTIONS.reduce((sum, question) => sum + (ANSWER_VALUES[answerMap.get(question.id)?.value] ?? 0), 0);
  const globalScore = normalize(rawScore, 120);
  const economicPoints = QUESTIONS.filter((question) => question.block === 'I').reduce((sum, question) => sum + (ANSWER_VALUES[answerMap.get(question.id)?.value] ?? 0), 0);
  const economicSubscore = normalize(economicPoints, 20);
  const aess = calculateAess(answerMap);

  const dimensions = {};
  for (const dimension of ['TECHNIQUE', 'REGLEMENTAIRE', 'OPERATIONNEL', 'ECONOMIQUE', 'ECOSYSTEME']) {
    const subset = QUESTIONS.filter((question) => question.dimension === dimension);
    const points = subset.reduce((sum, question) => sum + (ANSWER_VALUES[answerMap.get(question.id)?.value] ?? 0), 0);
    dimensions[dimension.toLowerCase()] = normalize(points, subset.length * 4);
  }

  let statusRank = scoreToStatus(globalScore);
  const gates = [];

  const economicCriticalFailure = criticalFailures.some((id) => ECONOMIC_CRITICALS.has(id));
  if (economicCriticalFailure) {
    statusRank = capStatus(statusRank, STATUS.HIGH_RISK);
    gates.push('ECONOMIC_CRITICAL_FAILURE');
  } else if (economicSubscore < 60 || aess.score < 60) {
    statusRank = capStatus(statusRank, STATUS.CONDITIONALLY_READY);
    gates.push('ECONOMIC_SUSTAINABILITY_BELOW_60');
  }

  if (statusRank === STATUS.STRATEGICALLY_READY && (!evidenceGatePassed || aess.score < 90)) {
    statusRank = STATUS.READY_WITH_CONTROLS;
    gates.push('STRATEGIC_STATUS_REQUIRES_EVIDENCE_AND_AESS_90');
  }

  const positiveVerdictAllowed = criticalUnanswered.length === 0 && missingQuestions.length === 0;
  if (!positiveVerdictAllowed && statusRank > STATUS.HIGH_RISK) {
    statusRank = STATUS.HIGH_RISK;
    gates.push('CRITICAL_OR_REQUIRED_ANSWERS_MISSING');
  }

  return Object.freeze({
    contract_version: 'DIAG30-v2.1',
    raw_score: rawScore,
    maximum_raw_score: 120,
    global_score: globalScore,
    economic_subscore: economicSubscore,
    aess,
    dimensions,
    status: STATUS_NAMES[statusRank],
    status_rank: statusRank,
    positive_verdict_allowed: positiveVerdictAllowed,
    missing_questions: missingQuestions,
    unanswered_questions: unansweredQuestions,
    critical_unanswered: criticalUnanswered,
    critical_failures: criticalFailures,
    gates,
  });
}

export function createAnswer(questionId, value, extras = {}) {
  const question = QUESTION_INDEX[questionId];
  if (!question) throw new RangeError(`Unknown question_id: ${questionId}`);
  const answer = {
    question_id: questionId,
    block_id: question.block,
    value,
    is_critical: question.critical,
    evidence_level: extras.evidence_level ?? 'DECLARATIF',
    evidence_reference: extras.evidence_reference ?? null,
    comment: extras.comment ?? null,
    updated_at: extras.updated_at ?? new Date().toISOString(),
  };
  assertAnswer(answer);
  return answer;
}
