import { canTransition } from './workflow';

describe('APDP BJ dossier workflow', () => {
  it('accepts the canonical happy path', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransition('ADMISSIBLE', 'ASSIGNED')).toBe(true);
    expect(canTransition('DECISION_PREPARED', 'DECIDED')).toBe(true);
    expect(canTransition('DECIDED', 'NOTIFIED')).toBe(true);
  });

  it('forbids bypassing human validation', () => {
    expect(canTransition('UNDER_ANALYSIS', 'DECIDED')).toBe(false);
    expect(canTransition('ADMISSIBLE', 'DECIDED')).toBe(false);
  });

  it('allows a complement loop', () => {
    expect(canTransition('UNDER_ANALYSIS', 'COMPLEMENT_REQUESTED')).toBe(true);
    expect(canTransition('COMPLEMENT_REQUESTED', 'UNDER_COMPLETENESS_REVIEW')).toBe(true);
  });
});
