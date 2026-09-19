export const ANSWER_VALUES = Object.freeze({
  NON_RENSEIGNE: null,
  NON: 0,
  PARTIEL: 2,
  DOCUMENTE: 4,
});

export const STATUS = Object.freeze({
  NOT_READY: 0,
  HIGH_RISK: 1,
  CONDITIONALLY_READY: 2,
  READY_WITH_CONTROLS: 3,
  STRATEGICALLY_READY: 4,
});

const q = (id, block, critical, dimension) => ({ id, block, critical, dimension });

export const QUESTIONS = Object.freeze([
  q('A1', 'A', true, 'REGLEMENTAIRE'), q('A2', 'A', false, 'REGLEMENTAIRE'), q('A3', 'A', false, 'REGLEMENTAIRE'),
  q('B1', 'B', true, 'REGLEMENTAIRE'), q('B2', 'B', true, 'REGLEMENTAIRE'), q('B3', 'B', false, 'TECHNIQUE'), q('B4', 'B', false, 'OPERATIONNEL'),
  q('C1', 'C', true, 'TECHNIQUE'), q('C2', 'C', true, 'TECHNIQUE'), q('C3', 'C', false, 'TECHNIQUE'), q('C4', 'C', false, 'ECOSYSTEME'),
  q('D1', 'D', true, 'TECHNIQUE'), q('D2', 'D', false, 'TECHNIQUE'), q('D3', 'D', false, 'OPERATIONNEL'),
  q('E1', 'E', true, 'OPERATIONNEL'), q('E2', 'E', false, 'OPERATIONNEL'),
  q('F1', 'F', true, 'TECHNIQUE'), q('F2', 'F', true, 'OPERATIONNEL'), q('F3', 'F', false, 'OPERATIONNEL'),
  q('G1', 'G', true, 'OPERATIONNEL'), q('G2', 'G', false, 'ECOSYSTEME'), q('G3', 'G', false, 'ECOSYSTEME'),
  q('H1', 'H', false, 'REGLEMENTAIRE'), q('H2', 'H', true, 'OPERATIONNEL'), q('H3', 'H', false, 'ECOSYSTEME'),
  q('I1', 'I', true, 'ECONOMIQUE'), q('I2', 'I', true, 'ECONOMIQUE'), q('I3', 'I', false, 'ECONOMIQUE'), q('I4', 'I', true, 'ECONOMIQUE'), q('I5', 'I', false, 'ECOSYSTEME'),
]);

export const QUESTION_INDEX = Object.freeze(Object.fromEntries(QUESTIONS.map((item) => [item.id, item])));

if (QUESTIONS.length !== 30) {
  throw new Error(`DIAG30 contract violation: expected 30 questions, got ${QUESTIONS.length}`);
}
