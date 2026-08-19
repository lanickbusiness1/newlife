'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { candidateApi, CandidateApiError } from '../../lib/http/api-client.js';
import type { CareerPathwayResult } from '../../lib/services/career-pathway-service.js';
import type { CareerNextAction, ScoreComponent } from '../../lib/domain/career-progression.js';
import styles from './CareerPathwayPanel.module.css';

const STATUS_LABELS = {
  ELIGIBLE: 'Éligible',
  REVIEW_REQUIRED: 'À vérifier',
  INELIGIBLE: 'Non éligible',
} as const;

const MISSING_LABELS: Record<string, string> = {
  age: 'Âge à renseigner',
  nationalities: 'Nationalité à renseigner',
  residenceCountryCode: 'Pays de résidence à renseigner',
  highestEducationLevel: 'Niveau d’études à structurer',
  yearsExperience: 'Années d’expérience à renseigner',
  languageCodes: 'Langues à renseigner',
};

const COMPONENT_LABELS: Record<string, string> = {
  goalAlignment: 'Objectif carrière',
  evidenceGain: 'Preuves',
  skillGain: 'Compétences',
  futureEligibilityUnlock: 'Éligibilités futures',
  networkExposure: 'Réseau institutionnel',
  immediateFit: 'Adéquation immédiate',
};

function formatMissingData(action: CareerNextAction): string[] {
  return action.missingData.map((key) => MISSING_LABELS[key] ?? key);
}

function ScoreBreakdown({ action }: { action: CareerNextAction }) {
  const entries = Object.entries(action.progressionScore.components) as Array<[string, ScoreComponent]>;
  return (
    <details className={styles.details}>
      <summary>Pourquoi ce score ?</summary>
      <div className={styles.scoreGrid}>
        {entries.map(([key, component]) => (
          <div key={key}>
            <span>{COMPONENT_LABELS[key] ?? key}</span>
            <strong>{Math.round(component.raw)}/100</strong>
            <small>Poids {component.weight}%</small>
          </div>
        ))}
      </div>
    </details>
  );
}

function PathwayCard({ action }: { action: CareerNextAction }) {
  const missing = formatMissingData(action);
  return (
    <article className={`candidate-card ${styles.card}`}>
      <div className={styles.cardHead}>
        <div>
          <span className="candidate-kicker">#{action.rank} · {action.opportunity.kind.replaceAll('_', ' ')}</span>
          <h3>{action.opportunity.title}</h3>
          <p>{action.opportunity.organization}</p>
        </div>
        <span className={styles.status}>{STATUS_LABELS[action.eligibility.status]}</span>
      </div>

      <div className={styles.score}>
        <strong>{Math.round(action.progressionScore.total)}</strong>
        <div>
          <span>Score de progression — heuristique explicable</span>
          <small>Ce score classe une prochaine action. Il ne prédit ni recrutement ni admission.</small>
        </div>
      </div>

      {action.whyThisNext.length > 0 && (
        <div className={styles.reasons}>
          {action.whyThisNext.map((reason) => <span key={reason}>{reason}</span>)}
        </div>
      )}

      {missing.length > 0 && (
        <div className={styles.missing}>
          <strong>Données à compléter</strong>
          <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      {action.eligibility.reviewRuleIds.length > 0 && (
        <p className={styles.review}>Des critères du programme ou de la vacance doivent être vérifiés sur la source officielle avant toute décision.</p>
      )}

      <ScoreBreakdown action={action} />
      <a className={`candidate-button secondary ${styles.source}`} href={action.opportunity.sourceUrl} target="_blank" rel="noreferrer">
        Source officielle
      </a>
    </article>
  );
}

export function CareerPathwayPanel() {
  const [goal, setGoal] = useState('');
  const [result, setResult] = useState<CareerPathwayResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingFacts = useMemo(() => {
    if (!result) return [];
    return [...new Set(result.actions.flatMap(formatMissingData))];
  }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = goal.trim();
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await candidateApi.careerPathway(target));
    } catch (reason: unknown) {
      setResult(null);
      setError(reason instanceof CandidateApiError ? reason.message : 'Impossible de calculer cette trajectoire de manière sûre.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`candidate-shell candidate-section ${styles.section}`} aria-labelledby="career-pathway-title">
      <div className={`candidate-card ${styles.control}`}>
        <span className="candidate-kicker">Opportunity Intelligence™</span>
        <h2 id="career-pathway-title">Quelle étape vous rapproche réellement de votre carrière cible ?</h2>
        <p>Jobs, volontariats, programmes jeunes talents et autres portes d’entrée sont comparés avec des règles d’éligibilité explicables et des sources officielles.</p>
        <form className={styles.form} onSubmit={submit}>
          <label htmlFor="career-goal">Objectif de carrière</label>
          <div className={styles.formRow}>
            <input
              className={styles.input}
              id="career-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Ex. Programme Officer au PNUD"
              maxLength={160}
              autoComplete="off"
            />
            <button className="candidate-button primary" type="submit" disabled={loading || !goal.trim()}>
              {loading ? 'Calcul en cours…' : 'Calculer ma prochaine étape'}
            </button>
          </div>
        </form>
        <p className={styles.disclaimer}>Aucune candidature n’est envoyée automatiquement. Les données inconnues restent inconnues et déclenchent une vérification.</p>
        {error && <div className="candidate-alert error" role="alert">{error}</div>}
      </div>

      {result && (
        <div className={styles.results} aria-live="polite">
          <div className={styles.resultsHead}>
            <div>
              <span className="candidate-kicker">Objectif · {result.goal.title}</span>
              <h2>Prochaines étapes recommandées</h2>
            </div>
            <span className={styles.count}>{result.actions.length} opportunités analysées</span>
          </div>

          {missingFacts.length > 0 && (
            <div className={`candidate-alert ${styles.dataAlert}`}>
              <strong>Données à compléter pour augmenter la précision :</strong> {missingFacts.join(' · ')}
            </div>
          )}

          <div className={styles.list}>
            {result.actions.map((action) => <PathwayCard key={action.opportunity.id} action={action} />)}
          </div>
        </div>
      )}
    </section>
  );
}
