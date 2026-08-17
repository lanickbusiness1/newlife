'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CandidateContext } from '../../lib/repositories/candidate-context.js';
import type { ConfirmedFact } from '../../lib/domain/evidence-elicitation.js';
import type { JobSpec } from '../../lib/domain/types.js';
import { candidateApi, CandidateApiError, type DiagnosticResponse, type GapAnalysisResponse, type VariantsResponse } from '../../lib/http/api-client.js';
import { EvidenceBadge } from '../evidence/EvidenceBadge';
import { CandidateHeader } from './CandidateHeader';
import { DiagnosticPanel } from './DiagnosticPanel';
import { GapMatrix } from './GapMatrix';
import { RecruiterLensPanel } from './RecruiterLensPanel';
import { VariantComparison } from './VariantComparison';

export function CvOptimizerFlow() {
  const [context, setContext] = useState<CandidateContext | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [jobs, setJobs] = useState<JobSpec[]>([]);
  const [showJobs, setShowJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [gap, setGap] = useState<GapAnalysisResponse | null>(null);
  const [elicitedFact, setElicitedFact] = useState('');
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

  function confirmedFactsForRewrite(): ConfirmedFact[] {
    if (!firstExperience || !elicitedFact.trim()) return [];
    return [{
      key: 'scope',
      value: elicitedFact.trim(),
      status: 'DECLARED',
      sourceRef: `experience:${firstExperience.id}`,
    }];
  }

  return (
    <main className="candidate-page">
      <CandidateHeader />
      <section className="candidate-shell optimizer-hero">
        <Link className="back-link" href="/candidate/dashboard">← Retour au tableau de bord</Link>
        <p className="eyebrow">Candidate Career Intelligence Flow™</p>
        <h1>Je veux décrocher ce poste</h1>
        <p className="candidate-lead">AfrIA Recruit™ part de vos faits réels, lit l’offre comme un recruteur, montre les preuves manquantes et prépare un dossier que vous validez vous-même.</p>
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
                <button className="candidate-button primary" disabled={!selectedJobId || busy !== null} onClick={() => act('gap', () => candidateApi.gapAnalysis(selectedJobId), (value) => { setGap(value); setElicitedFact(''); setRewriteConsent(false); setRewrite(null); })}>{busy === 'gap' ? 'Comparaison…' : 'Analyser les écarts'}</button>
              </section>
            ) : null}

            {gap ? (
              <section className="flow-panel" aria-labelledby="gap-heading">
                <div className="flow-panel-head"><span className="step-number">04</span><div><h2 id="gap-heading">Matrice exigences ↔ preuves</h2><p>Un GAP reste visible : AfrIA Recruit™ ne le transforme jamais en compétence du candidat.</p></div></div>
                <GapMatrix rows={gap.analysis.requirements} />
                <RecruiterLensPanel items={gap.recruiterLens} />
                {firstExperience ? (
                  <div className="rewrite-box">
                    <div className="elicitation-box">
                      <h3>Evidence Elicitation™</h3>
                      <p>Avant de reformuler, vous pouvez préciser un fait réel que le CV n’exprime pas encore clairement. Il reste <strong>DECLARED</strong> tant qu’aucune preuve distincte ne le fait évoluer.</p>
                      <label htmlFor="elicited-fact">Fait complémentaire confirmé</label>
                      <textarea
                        id="elicited-fact"
                        value={elicitedFact}
                        maxLength={500}
                        onChange={(event) => setElicitedFact(event.target.value)}
                        placeholder="Ex. Coordination de plusieurs équipes terrain sur plusieurs sites. N’ajoutez aucun chiffre que vous ne pouvez pas soutenir."
                      />
                    </div>
                    <div><strong>Achievement Writer™</strong><p>{firstExperience.description}</p></div>
                    <label className="consent-check">
                      <input type="checkbox" checked={rewriteConsent} onChange={(event) => setRewriteConsent(event.target.checked)} />
                      <span>J’autorise le traitement de cet extrait de CV pour cette reformulation. Si un fournisseur IA externe est activé, ce consentement est enregistré avant tout envoi.</span>
                    </label>
                    <button className="candidate-button secondary" disabled={busy !== null || !rewriteConsent} onClick={() => act('rewrite', () => candidateApi.rewrite(firstExperience.id, firstExperience.description ?? '', gap.jobSpec.id, rewriteConsent, confirmedFactsForRewrite()), (value) => setRewrite(value.rewrite.text))}>{busy === 'rewrite' ? 'Réécriture…' : 'Proposer une reformulation'}</button>
                    {rewrite ? <div className="rewrite-result"><span>Proposition contrôlée</span><p>{rewrite}</p><small>Un fait saisi ici reste DECLARED. Aucun chiffre n’est promu en métrique vérifiée sans preuve distincte.</small></div> : null}
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
