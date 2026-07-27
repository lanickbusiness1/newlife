import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnswer, scoreDiagnostic } from '../src/engine.js';
import { QUESTIONS } from '../src/questions.js';

const all = (value) => QUESTIONS.map((question) => createAnswer(question.id, value, { updated_at: '2026-07-27T00:00:00.000Z' }));
const replace = (answers, id, value) => answers.map((answer) => answer.question_id === id ? createAnswer(id, value, { updated_at: answer.updated_at }) : answer);

function answersForRawScore(target) {
  const answers = all('NON');
  let remaining = target;
  for (let index = 0; index < answers.length && remaining > 0; index += 1) {
    const points = Math.min(4, remaining);
    const value = points >= 4 ? 'DOCUMENTE' : 'PARTIEL';
    answers[index] = createAnswer(answers[index].question_id, value, { updated_at: '2026-07-27T00:00:00.000Z' });
    remaining -= points >= 4 ? 4 : 2;
  }
  return answers;
}

test('registry contains exactly 30 questions', () => {
  assert.equal(QUESTIONS.length, 30);
});

test('zero score is NOT_READY', () => {
  const result = scoreDiagnostic(all('NON'));
  assert.equal(result.raw_score, 0);
  assert.equal(result.global_score, 0);
  assert.equal(result.status, 'NOT_READY');
});

test('maximum score requires evidence gate for STRATEGICALLY_READY', () => {
  const withoutEvidence = scoreDiagnostic(all('DOCUMENTE'));
  assert.equal(withoutEvidence.global_score, 100);
  assert.equal(withoutEvidence.status, 'READY_WITH_CONTROLS');
  const withEvidence = scoreDiagnostic(all('DOCUMENTE'), { evidenceGatePassed: true });
  assert.equal(withEvidence.status, 'STRATEGICALLY_READY');
  assert.equal(withEvidence.aess.score, 100);
});

test('normalization is exact at representative boundaries', () => {
  for (const raw of [0, 48, 72, 90, 108, 120]) {
    const result = scoreDiagnostic(answersForRawScore(raw), { evidenceGatePassed: true });
    assert.equal(result.global_score, Math.round(raw / 120 * 100));
  }
});

test('I1 failure caps global status at HIGH_RISK', () => {
  const result = scoreDiagnostic(replace(all('DOCUMENTE'), 'I1', 'NON'), { evidenceGatePassed: true });
  assert.equal(result.status, 'HIGH_RISK');
  assert.ok(result.gates.includes('ECONOMIC_CRITICAL_FAILURE'));
});

test('I2 failure caps global status at HIGH_RISK', () => {
  const result = scoreDiagnostic(replace(all('DOCUMENTE'), 'I2', 'NON'), { evidenceGatePassed: true });
  assert.equal(result.status, 'HIGH_RISK');
});

test('I4 failure caps global status at HIGH_RISK', () => {
  const result = scoreDiagnostic(replace(all('DOCUMENTE'), 'I4', 'NON'), { evidenceGatePassed: true });
  assert.equal(result.status, 'HIGH_RISK');
});

test('economic score below 60 caps at CONDITIONALLY_READY', () => {
  let answers = all('DOCUMENTE');
  answers = replace(answers, 'I3', 'NON');
  answers = replace(answers, 'I5', 'NON');
  const result = scoreDiagnostic(answers, { evidenceGatePassed: true });
  assert.ok(result.economic_subscore < 60 || result.aess.score < 60);
  assert.equal(result.status, 'CONDITIONALLY_READY');
});

test('NON_RENSEIGNE remains distinct and prevents positive verdict', () => {
  const answers = replace(all('DOCUMENTE'), 'A1', 'NON_RENSEIGNE');
  const result = scoreDiagnostic(answers, { evidenceGatePassed: true });
  assert.ok(result.unanswered_questions.includes('A1'));
  assert.ok(result.critical_unanswered.includes('A1'));
  assert.equal(result.positive_verdict_allowed, false);
  assert.equal(result.status, 'HIGH_RISK');
});

test('missing required answer prevents positive verdict', () => {
  const answers = all('DOCUMENTE').filter((answer) => answer.question_id !== 'B1');
  const result = scoreDiagnostic(answers, { evidenceGatePassed: true });
  assert.deepEqual(result.missing_questions, ['B1']);
  assert.equal(result.status, 'HIGH_RISK');
});

test('duplicate answers are rejected', () => {
  const answers = all('DOCUMENTE');
  answers.push(answers[0]);
  assert.throws(() => scoreDiagnostic(answers), /Duplicate answer/);
});

test('unknown questions and invalid values are rejected', () => {
  assert.throws(() => createAnswer('Z9', 'NON'), /Unknown question_id/);
  assert.throws(() => createAnswer('A1', 'OUI'), /Invalid answer value/);
});

test('five dimension subscores are returned', () => {
  const result = scoreDiagnostic(all('DOCUMENTE'), { evidenceGatePassed: true });
  assert.deepEqual(Object.keys(result.dimensions).sort(), ['ecosysteme', 'economique', 'operationnel', 'reglementaire', 'technique']);
  Object.values(result.dimensions).forEach((score) => assert.equal(score, 100));
});
