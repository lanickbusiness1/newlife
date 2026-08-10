import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerInvestorQuestion,
  createWelcomeMessage,
} from '../src/assistant.js';

test('welcome states the guided scope without claiming an autonomous AI decision', () => {
  assert.deepEqual(createWelcomeMessage(), {
    text: 'Bonjour, je suis l’assistant guidé AfrIA Recruit™. Je peux expliquer la solution, le matching, la confidentialité ou vous orienter vers un échange avec l’équipe.',
    actions: false,
  });
});

test('matching answer explains criteria and keeps the final decision human', () => {
  const result = answerInvestorQuestion('Comment fonctionne le matching ?');

  assert.equal(result.actions, false);
  assert.match(result.text, /critères lisibles/i);
  assert.match(result.text, /décision finale reste humaine/i);
});

test('privacy answer requires consent before any profile sharing', () => {
  const result = answerInvestorQuestion('Comment protégez-vous les données privées ?');

  assert.equal(result.actions, false);
  assert.match(result.text, /consentement explicite/i);
  assert.match(result.text, /aucune donnée personnelle réelle/i);
});

test('pilot and team questions return a contact action instead of a boolean', () => {
  for (const question of ['Je veux un pilote', 'Parler à l’équipe']) {
    const result = answerInvestorQuestion(question);

    assert.equal(typeof result.text, 'string');
    assert.equal(result.actions, true);
    assert.match(result.text, /échange de cadrage/i);
  }
});

test('unknown or malformed input receives a safe guided answer', () => {
  for (const question of ['', null, true]) {
    assert.deepEqual(answerInvestorQuestion(question), {
      text: 'Je peux vous aider sur le recrutement, le matching, la confidentialité, le modèle de pilote ou la prise de contact avec l’équipe.',
      actions: false,
    });
  }
});
