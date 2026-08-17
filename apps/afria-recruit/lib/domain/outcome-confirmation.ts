export type OutcomeConfirmationSource = 'candidate' | 'employer' | 'system';

export interface OutcomeConfirmation {
  source: OutcomeConfirmationSource;
  confirmed: boolean;
}

export function isOutcomeConfirmed(confirmations: OutcomeConfirmation[]): boolean {
  return confirmations.some((confirmation) =>
    confirmation.confirmed && (confirmation.source === 'employer' || confirmation.source === 'system'),
  );
}
