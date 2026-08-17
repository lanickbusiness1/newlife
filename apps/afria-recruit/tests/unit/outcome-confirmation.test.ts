import test from 'node:test';
import assert from 'node:assert/strict';
import { isOutcomeConfirmed, type OutcomeConfirmation } from '../../lib/domain/outcome-confirmation.js';

test('candidate report alone never confirms outcome', () => {
  const confirmations: OutcomeConfirmation[] = [{ source: 'candidate', confirmed: true }];
  assert.equal(isOutcomeConfirmed(confirmations), false);
});

test('employer confirmation can confirm outcome', () => {
  const confirmations: OutcomeConfirmation[] = [
    { source: 'candidate', confirmed: true },
    { source: 'employer', confirmed: true },
  ];
  assert.equal(isOutcomeConfirmed(confirmations), true);
});

test('system confirmation can confirm outcome without candidate self-confirmation', () => {
  assert.equal(isOutcomeConfirmed([{ source: 'system', confirmed: true }]), true);
});

test('unconfirmed employer or system signal does not confirm outcome', () => {
  assert.equal(isOutcomeConfirmed([
    { source: 'candidate', confirmed: true },
    { source: 'employer', confirmed: false },
    { source: 'system', confirmed: false },
  ]), false);
});
