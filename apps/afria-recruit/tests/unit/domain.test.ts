import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureCandidateRepository, SYNTHETIC_CANDIDATE_ID } from '../../lib/repositories/fixture-candidate-repository.js';
import { normalizeEvidenceLevel } from '../../lib/domain/evidence.js';
import { classifyRequirementCoverage } from '../../lib/domain/gap-matching.js';
import { findTruthConflicts } from '../../lib/domain/truth-consistency.js';
import { rewriteAchievement } from '../../lib/domain/achievement-writer.js';
import { calculateObservedMetrics } from '../../lib/domain/metrics.js';
import type { JobSpec } from '../../lib/domain/types.js';

const targetJob: JobSpec = {
  id: 'job-synthetic-finance',
  title: 'Responsable conformité régionale',
  countryCode: 'SN',
  requirements: [
    { id: 'req-project', kind: 'skill', label: 'Gestion de projets', required: true, skillId: 'skill-project', minimumYears: 5 },
    { id: 'req-logistics', kind: 'skill', label: 'Logistique humanitaire', required: false, skillId: 'skill-logistics', minimumYears: 3 },
    { id: 'req-finance', kind: 'skill', label: 'Conformité financière', required: true, skillId: 'skill-finance', minimumYears: 2 },
    { id: 'req-en', kind: 'language', label: 'Anglais B2', required: true, languageCode: 'en', minimumLevel: 'B2' },
  ],
};

test('extracted or declared facts are never promoted to verified', () => {
  assert.equal(normalizeEvidenceLevel('declared'), 'DECLARED');
  assert.equal(normalizeEvidenceLevel('parsed'), 'DECLARED');
  assert.equal(normalizeEvidenceLevel('evidenced'), 'EVIDENCED');
  assert.equal(normalizeEvidenceLevel('verified'), 'VERIFIED');
});

test('gap matching never turns an unsupported job keyword into a candidate claim', async () => {
  const context = await new FixtureCandidateRepository().loadContext(SYNTHETIC_CANDIDATE_ID);
  const rows = classifyRequirementCoverage(context, targetJob);
  const finance = rows.find((row) => row.requirementId === 'req-finance');
  assert.equal(finance?.coverage, 'GAP');
  assert.deepEqual(finance?.evidenceRefs, []);
  assert.equal(context.skills.some((skill) => skill.skillId === 'skill-finance'), false);
});

test('evidence status affects COVERED versus PARTIAL deterministically', async () => {
  const context = await new FixtureCandidateRepository().loadContext(SYNTHETIC_CANDIDATE_ID);
  const rows = classifyRequirementCoverage(context, targetJob);
  assert.equal(rows.find((row) => row.requirementId === 'req-project')?.coverage, 'COVERED');
  assert.equal(rows.find((row) => row.requirementId === 'req-logistics')?.coverage, 'PARTIAL');
  assert.equal(rows.find((row) => row.requirementId === 'req-en')?.coverage, 'COVERED');
});

test('chronology contradictions are blocking truth conflicts', async () => {
  const context = await new FixtureCandidateRepository().loadContext(SYNTHETIC_CANDIDATE_ID);
  context.experiences[0] = {
    ...context.experiences[0],
    isCurrent: false,
    startDate: '2025-09-01',
    endDate: '2024-03-01',
  };
  const conflicts = findTruthConflicts(context);
  assert.ok(conflicts.some((conflict) => conflict.code === 'EXPERIENCE_DATE_ORDER' && conflict.blocking));
});

test('achievement rewriting never fabricates a percentage or number', () => {
  const source = 'Amélioration de la satisfaction des bénéficiaires par une meilleure coordination.';
  const rewritten = rewriteAchievement({ sourceStatement: source, verifiedMetrics: [] });
  assert.doesNotMatch(rewritten.text, /\d|%/);
  assert.deepEqual(rewritten.usedMetrics, []);
});

test('achievement rewriting uses only metrics explicitly supplied as factual', () => {
  const rewritten = rewriteAchievement({
    sourceStatement: 'Coordination des équipes terrain.',
    verifiedMetrics: [{ value: '12 équipes', sourceRef: 'exp-synth-1' }],
  });
  assert.match(rewritten.text, /12 équipes/);
  assert.deepEqual(rewritten.usedMetrics, ['exp-synth-1']);
});

test('conversion metrics count confirmed outcomes only', () => {
  const metrics = calculateObservedMetrics([
    { type: 'application', confirmed: true },
    { type: 'application', confirmed: true },
    { type: 'interview', confirmed: true },
    { type: 'interview', confirmed: false },
    { type: 'offer', confirmed: false },
    { type: 'hired', confirmed: true },
  ]);
  assert.equal(metrics.applications, 2);
  assert.equal(metrics.confirmedInterviews, 1);
  assert.equal(metrics.confirmedOffers, 0);
  assert.equal(metrics.confirmedHires, 1);
  assert.equal(metrics.interviewRate, 0.5);
  assert.equal(metrics.offerRate, 0);
});
