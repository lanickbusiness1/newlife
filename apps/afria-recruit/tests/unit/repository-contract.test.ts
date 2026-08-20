import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureCandidateRepository } from '../../lib/repositories/fixture-candidate-repository.js';

const syntheticCandidateId = '00000000-0000-4000-8000-000000000101';

test('fixture repository exposes a complete synthetic Talent Passport context', async () => {
  const repository = new FixtureCandidateRepository();
  const context = await repository.loadContext(syntheticCandidateId);

  assert.equal(context.candidate.id, syntheticCandidateId);
  assert.ok(context.experiences.length > 0);
  assert.ok(context.educations.length > 0);
  assert.ok(context.skills.length > 0);
  assert.ok(context.languages.length > 0);
  assert.ok(context.documents.every((document) => document.synthetic));
  assert.ok(context.experiences.every((experience) => !experience.organization.includes('@')));
});

test('fixture repository refuses unknown candidate ids rather than leaking another fixture', async () => {
  const repository = new FixtureCandidateRepository();
  await assert.rejects(() => repository.loadContext('unknown'), /candidate not found/i);
});
