import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureCandidateRepository, SYNTHETIC_CANDIDATE_ID } from '../../lib/repositories/fixture-candidate-repository.js';
import { buildElicitationQuestions, type ConfirmedFact } from '../../lib/domain/evidence-elicitation.js';
import { rewriteAchievement } from '../../lib/domain/achievement-writer.js';
import type { RecruiterLensItem } from '../../lib/domain/recruiter-lens.js';

const lens: RecruiterLensItem[] = [
  {
    requirementId: 'finance',
    requirement: 'Conformité financière',
    priority: 'BLOCKING',
    coverage: 'GAP',
    evidenceRefs: [],
    riskFlags: ['BLOCKING_REQUIREMENT_UNPROVEN'],
    likelyQuestions: ['Quelle preuve concrète pouvez-vous fournir ?'],
    doNotClaim: ['Conformité financière'],
    proofChallenge: {
      type: 'WORK_SAMPLE',
      requirementId: 'finance',
      reason: 'Preuve nécessaire.',
      promotesEvidence: false,
    },
  },
];

test('elicitation questions discover context but do not create candidate facts', async () => {
  const context = await new FixtureCandidateRepository().loadContext(SYNTHETIC_CANDIDATE_ID);
  const experience = context.experiences[0]!;
  const questions = buildElicitationQuestions(experience, lens);
  assert.ok(questions.length > 0);
  assert.equal(questions[0]?.sourceRef, `experience:${experience.id}`);
  assert.equal('value' in (questions[0] ?? {}), false);
});

test('confirmed elicited fact defaults to DECLARED and remains separate from verified metrics', () => {
  const fact: ConfirmedFact = {
    key: 'team_size',
    value: '12 personnes',
    status: 'DECLARED',
    sourceRef: 'experience:exp-synth-1',
  };
  const rewritten = rewriteAchievement({
    sourceStatement: 'Coordination des équipes terrain.',
    verifiedMetrics: [],
    confirmedFacts: [fact],
  });
  assert.equal(fact.status, 'DECLARED');
  assert.match(rewritten.text, /12 personnes/);
  assert.deepEqual(rewritten.usedMetrics, []);
  assert.deepEqual(rewritten.usedConfirmedFacts, ['experience:exp-synth-1:team_size']);
});

test('confirmed fact without provenance is rejected', () => {
  assert.throws(
    () => rewriteAchievement({
      sourceStatement: 'Coordination terrain.',
      verifiedMetrics: [],
      confirmedFacts: [{ key: 'budget', value: '1000000', status: 'VERIFIED', sourceRef: '' }],
    }),
    /source/i,
  );
});
