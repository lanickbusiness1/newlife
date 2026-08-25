export type OutcomeType = 'application' | 'interview' | 'offer' | 'hired';

export interface OutcomeMetricEvent {
  type: OutcomeType;
  confirmed: boolean;
}

export interface ObservedMetrics {
  applications: number;
  confirmedInterviews: number;
  confirmedOffers: number;
  confirmedHires: number;
  interviewRate: number;
  offerRate: number;
  hireRate: number;
}

export function calculateObservedMetrics(events: OutcomeMetricEvent[]): ObservedMetrics {
  const confirmed = events.filter((event) => event.confirmed);
  const applications = confirmed.filter((event) => event.type === 'application').length;
  const confirmedInterviews = confirmed.filter((event) => event.type === 'interview').length;
  const confirmedOffers = confirmed.filter((event) => event.type === 'offer').length;
  const confirmedHires = confirmed.filter((event) => event.type === 'hired').length;
  const rate = (count: number) => applications > 0 ? count / applications : 0;

  return {
    applications,
    confirmedInterviews,
    confirmedOffers,
    confirmedHires,
    interviewRate: rate(confirmedInterviews),
    offerRate: rate(confirmedOffers),
    hireRate: rate(confirmedHires),
  };
}
