'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CandidateContext } from '../../lib/repositories/candidate-context.js';
import type { JobSpec } from '../../lib/domain/types.js';
import { candidateApi, CandidateApiError, type DiagnosticResponse, type GapAnalysisResponse, type ReadinessResponse, type VariantsResponse } from '../../lib/http/api-client.js';
import { EvidenceBadge } from '../evidence/EvidenceBadge';
import { CandidateHeader } from './CandidateHeader';
import { DiagnosticPanel } from './DiagnosticPanel';
import { GapMatrix } from './GapMatrix';
import { VariantComparison } from './VariantComparison';

export function CvOptimizerFlow() {
  const [context, setContext] = useState<CandidateContext | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [jobs, setJobs] = useState<JobSpec[]>([]);
  const [showJobs, setShowJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [gap, setGap] = useState<GapAnalysisResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessUnavailable, setReadinessUnavailable] = useState<string | null>(null);
  const [rewrite, setRewrite] = useState<string | null>(null);
  const [rewriteConsent, setRewriteConsent] = useState(false);
  const [variants, setVariants] = useState<VariantsResponse | null>(null);
  const [rationale, setRationale] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    candidateApi.context()
      .then(({ context: value }) => setContext(value))
      .catch((reason: unknown) => setError(reason instanceof CandidateApiError ? reason.message : 'Impossible de charger le Talent Passport™.'));
  }, []);

  useEffect(() => {
    if (gap) window.localStorage.setItem('afria_recruit_selected_job_id', gap.jobSpec.id);
  }, [gap]);

  useEffect(() => {
    if (variants) window.localStorage.setItem('afria_recruit_latest_variants_decision_id', variants.decisionId);
  }, [variants]);

  const firstExperience = context?.experiences.find((experience) => Boolean(experience.description)) ?? null;
  const blocking = diagnostic?.diagnostic.findings.some((finding) => finding.blocking) ?? false;
  const progress = useMemo(() => {
    if (reviewed) return 6;
    if (variants) return 5;
    if (gap) return 4;
    if (showJobs) return 3;
    if (diagnostic) return 2;
    return 1;
  }, [diagnostic, showJobs, gap, variants, reviewed]);

  async function act<T>(label: string, operation: () => Promise<T>, onSuccess: (value: T) => void) {
    setBusy(label); setError(null);
    try { onSuccess(await operation()); }
    catch (reason) { setError(reason instanceof CandidateApiError ? reason.message : 'La demande a échoué de manière sûre.'); }
    finally { setBusy(null); }
  }

  async function chooseJob() {
    await act('jobs', candidateApi.jobs, ({ jobs: values }) => { setJobs(values); setShowJobs(true); });
  }

  async function analyzeSelectedJob() {
    if (!selectedJobId) return;
    setBusy('gap');
    setError(null);
    setReadiness(null);
    setReadinessUnavailable(null);
    try {
      const gapValue = await candidateApi.gapAnalysis(selectedJobId);
      setGap(gapValue);
      setRewriteConsent(false);
      setRewrite(null);
      try {
        setReadiness(await candidateApi.readiness(selectedJobId));
      } catch (reason) {
        if (reason instanceof CandidateApiError && reason.status === 409) {
          setReadinessUnavailable('Score non publié : les signaux ATS, sémantiques et institutionnels sourcés ne sont pas encore tous disponibles.');
        } else {
          throw reason;
        }
      }
    } catch (reason) {
      setError(reason instanceof CandidateApiError ? reason.message : 'La demande a échoué de manière sûre.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="candidate-page">
      <CandidateHeader />
      <section className="candidate-shell optimizer-hero">
        <Link className="back-link" href="/candidate/dashboard">← Retour au tableau de bord</Link>
        <p className="eyebrow">Candidate Career Intelligence Flow™</p>
        <h1>Optimiser mon CV</h1>
        <p className="candidate-lead">Nous améliorons la présentation de vos faits. Nous n’inventons ni compétence, ni diplôme, ni pourcentage.</p>
        <div className="flow-progress" aria-label={`Étape ${progress} sur 6`}>
          {Array.from({ length: 6 }, (_, index) => <span key={index} className={index < progress ? 'done' : ''} />)}
        </div>
      </section>

      <section className="candidate-shell candidate-section optimizer-stack">
        {error ? <div className="candidate-alert error" role="alert">{error}</div> : null}
        {!context ? <div className="candidate-loading" role="status">Chargement de vos faits vérifiables…</div> : (
          <>
            <section className="flow-panel" aria-labelledby="passport-heading">
              <div className="flow-panel-head"><span className="step-number">01</span><div><h2 id="passport-heading">Talent Passport™</h2><p>Vérifiez d’abord ce que le système sait réellement de vous.</p></div></div>
              <div className="fact-grid">
                {context.skills.map((skill) => (
                  <article className="fact-card" key={skill.skillId}>
                    <div><strong>{skill.name ?? 'Compétence'}</strong><span>{skill.yearsExperience ?? '—'} ans · {skill.proficiency}</span></div>
                    <EvidenceBadge status={skill.evidenceStatus} />
                  </article>
                ))}
                {context.languages.map((language) => (
                  <article className="fact-card" key={language.code}>
                    <div><strong>Langue {language.code.toUpperCase()}</strong><span>Niveau {language.level}</span></div>
                    <EvidenceBadge status={language.evidenceStatus} />
                  </article>
                ))}
              </div>
              {!diagnostic ? <button className="candidate-button primary" disabled={busy !== null} onClick={() => act('diagnostic', candidateApi.diagnostic, setDiagnostic)}>{busy === 'diagnostic' ? 'Analyse…' : 'Lancer le diagnostic'}</button> : null}
            </section>

            {diagnostic ? <DiagnosticPanel findings={diagnostic.diagnostic.findings} /> : null}

            {diagnostic && !showJobs ? (
              <div className="flow-cta"><button className="candidate-button primary" disabled={busy !== null || blocking} onClick={chooseJob}>{busy === 'jobs' ? 'Chargement…' : 'Choisir une offre cible'}</button>{blocking ? <span>Corrigez les incohérences bloquantes avant de continuer.</span> : null}</div>
            ) : null}

            {showJobs ? (
              <section className="flow-panel" aria-labelledby="job-heading">
                <div className="flow-panel-head"><span className="step-number">03</span><div><h2 id="job-heading">Offre cible</h2><p>Le matching part des exigences du poste, jamais de mots-clés ajoutés artificiellement.</p></div></div>
                {jobs.length === 0 ? <p>Aucune offre ouverte disponible.</p> : <div className="job-list">{jobs.map((job) => (
                  <label className={`job-option ${selectedJobId === job.id ? 'selected' : ''}`} key={job.id}>
                    <input type="radio" name="target-job" value={job.id} checked={selectedJobId === job.id} onChange={() => setSelectedJobId(job.id)} />
                    <span><strong>{job.title}</strong><small>{job.countryCode ?? 'Pays à préciser'} · {job.requirements.length} exigences structurées</small></span>
                  </label>
                ))}</div>}
                <button className="candidate-button primary" disabled={!selectedJobId || busy !== null} onClick={analyzeSelectedJob}>{busy === 'gap' ? 'Comparaison…' : 'Analyser les écarts'}</button>
              </section>
            ) : null}

            {gap ? (
              <section className="flow-panel" aria-labelledby="gap-heading">
                <div className="flow-panel-head"><span className="step-number">04</span><div><h2 id="gap-heading">Matrice exigences ↔ preuves</h2><p>Un GAP reste visible : AfrIA Recruit™ ne le transforme jamais en compétence du candidat.</p></div></div>
                <GapMatrix rows={gap.analysis.requirements} />

                {readiness ? (
                  <div className="rewrite-box" aria-labelledby="readiness-heading">
                    <div>
                      <h3 id="readiness-heading">Application Readiness™</h3>
                      <p>Score publié uniquement à partir de signaux sourcés et de preuves candidates admissibles.</p>
                    </div>
                    <div className="fact-card" data-testid="readiness-total">
                      <div><strong>Score global</strong><span>Compatibilité de candidature vérifiable</span></div>
                      <strong>{readiness.readiness.total}/100</strong>
                    </div>
                    <div className="fact-grid">
                      <article className="fact-card" data-testid="readiness-atsTechnical"><div><strong>ATS technique</strong><span>Parsing et lisibilité machine</span></div><strong>{readiness.readiness.dimensions.atsTechnical}/20</strong></article>
                      <article className="fact-card" data-testid="readiness-jobMatch"><div><strong>Compatibilité offre</strong><span>Exigences structurées</span></div><strong>{readiness.readiness.dimensions.jobMatch}/30</strong></article>
                      <article className="fact-card" data-testid="readiness-semanticFit"><div><strong>Fit sémantique</strong><span>Responsabilités réellement prouvées</span></div><strong>{readiness.readiness.dimensions.semanticFit}/20</strong></article>
                      <article className="fact-card" data-testid="readiness-evidence"><div><strong>Preuves</strong><span>Faits étayés dans le Talent Passport™</span></div><strong>{readiness.readiness.dimensions.evidence}/15</strong></article>
                      <article className="fact-card" data-testid="readiness-institutionFit"><div><strong>Fit institutionnel</strong><span>Critères sourcés de l’organisation cible</span></div><strong>{readiness.readiness.dimensions.institutionFit}/15</strong></article>
                    </div>
                    {readiness.readiness.gaps.length ? (
                      <div>
                        <strong>Actions prioritaires</strong>
                        <ul>
                          {readiness.readiness.gaps.map((item) => <li key={item.code}><strong>{item.label}</strong> — {item.action}</li>)}
                        </ul>
                      </div>
                    ) : <p>Aucun gap de readiness n’est détecté sur les signaux actuellement prouvés.</p>}
                  </div>
                ) : readinessUnavailable ? (
                  <div className="candidate-alert" role="status">{readinessUnavailable}</div>
                ) : null}

                {firstExperience ? (
                  <div className="rewrite-box">
                    <div><strong>Achievement Writer™</strong><p>{firstExperience.description}</p></div>
                    <label className="consent-check">
                      <input type="checkbox" checked={rewriteConsent} onChange={(event) => setRewriteConsent(event.target.checked)} />
                      <span>J’autorise le traitement de cet extrait de CV pour cette reformulation. Si un fournisseur IA externe est activé, ce consentement est enregistré avant tout envoi.</span>
                    </label>
                    <button className="candidate-button secondary" disabled={busy !== null || !rewriteConsent} onClick={() => act('rewrite', () => candidateApi.rewrite(firstExperience.id, firstExperience.description ?? '', gap.jobSpec.id, rewriteConsent), (value) => setRewrite(value.rewrite.text))}>{busy === 'rewrite' ? 'Réécriture…' : 'Proposer une reformulation'}</button>
                    {rewrite ? <div className="rewrite-result"><span>Proposition vérifiée</span><p>{rewrite}</p><small>Aucun chiffre ajouté sans métrique explicitement prouvée.</small></div> : null}
                  </div>
                ) : null}
                {!variants ? <button className="candidate-button primary" disabled={busy !== null} onClick={() => act('variants', () => candidateApi.variants(gap.jobSpec.id), setVariants)}>{busy === 'variants' ? 'Génération…' : 'Générer les deux versions'}</button> : null}
              </section>
            ) : null}

            {variants ? (
              <section className="flow-panel" aria-labelledby="variants-heading">
                <div className="flow-panel-head"><span className="step-number">05</span><div><h2 id="variants-heading">Deux rendus, les mêmes faits</h2><p>Le fingerprint identique prouve la parité factuelle entre les deux représentations.</p></div></div>
                <VariantComparison variants={variants.variants} />
                {!reviewed ? <div className="review-box"><label htmlFor="review-rationale">Raison de la validation</label><textarea id="review-rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Expliquez ce que vous avez contrôlé avant validation." /><button className="candidate-button primary" disabled={rationale.trim().length < 12 || busy !== null} onClick={() => act('review', () => candidateApi.review(variants.decisionId, rationale), () => setReviewed(true))}>{busy === 'review' ? 'Enregistrement…' : 'Valider humainement'}</button></div> : null}
              </section>
            ) : null}

            {reviewed ? <section className="flow-panel completion" aria-live="polite"><span className="completion-mark">✓</span><div><h2>Validation humaine enregistrée</h2><p>Votre dossier est prêt pour l’étape de préparation à l’entretien. Aucune candidature n’a été envoyée automatiquement.</p><Link className="candidate-button primary" href="/candidate/interview-coach">Préparer mon entretien</Link></div></section> : null}
          </>
        )}
      </section>
    </main>
  );
}
