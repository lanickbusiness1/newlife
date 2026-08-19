'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CandidateContext } from '../../lib/repositories/candidate-context.js';
import { candidateApi, CandidateApiError } from '../../lib/http/api-client.js';
import { CandidateHeader } from './CandidateHeader';
import { CareerPathwayPanel } from './CareerPathwayPanel';

export function CandidateDashboard() {
  const [context, setContext] = useState<CandidateContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    candidateApi.context()
      .then(({ context: value }) => setContext(value))
      .catch((reason: unknown) => setError(reason instanceof CandidateApiError ? reason.message : 'Impossible de charger le profil.'));
  }, []);

  return (
    <main className="candidate-page">
      <CandidateHeader />
      <section className="candidate-shell candidate-hero compact">
        <p className="eyebrow">AfrIA Recruit™</p>
        <h1>Candidate OS™</h1>
        <p className="candidate-lead">Un parcours carrière fondé sur vos faits, vos preuves et vos décisions.</p>
      </section>
      <section className="candidate-shell candidate-section">
        {error ? (
          <div className="candidate-alert error" role="alert">{error} <Link href="/login">Se connecter</Link></div>
        ) : !context ? (
          <div className="candidate-loading" role="status">Chargement du Talent Passport™…</div>
        ) : (
          <>
            <div className="candidate-grid dashboard-grid">
              <article className="candidate-card profile-card">
                <span className="candidate-kicker">Profil courant</span>
                <h2>{context.candidate.professionalTitle ?? 'Titre professionnel à compléter'}</h2>
                <p>{context.candidate.summary}</p>
                <div className="profile-meta">
                  <span>{context.candidate.currentCountry ?? 'Pays à préciser'}</span>
                  <span>{context.candidate.yearsExperience ?? '—'} ans d’expérience déclarée</span>
                </div>
              </article>
              <article className="candidate-card action-card">
                <span className="candidate-kicker">Prochaine action</span>
                <h2>Transformez votre CV en dossier de preuves ciblé.</h2>
                <p>Diagnostic, écarts poste, réécriture contrôlée, double CV et validation humaine.</p>
                <Link className="candidate-button primary" href="/candidate/cv-optimizer">Optimiser mon CV</Link>
              </article>
            </div>
            <div className="candidate-grid mini-grid">
              <article className="candidate-card mini"><strong>{context.skills.length}</strong><span>compétences structurées</span></article>
              <article className="candidate-card mini"><strong>{context.experiences.length}</strong><span>expériences</span></article>
              <article className="candidate-card mini"><strong>{context.languages.length}</strong><span>langues</span></article>
            </div>
          </>
        )}
      </section>
      {context && !error ? <CareerPathwayPanel /> : null}
    </main>
  );
}
