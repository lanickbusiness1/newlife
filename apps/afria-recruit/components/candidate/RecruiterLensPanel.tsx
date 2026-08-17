import type { RecruiterLensItem } from '../../lib/domain/recruiter-lens.js';

function challengeLabel(type: RecruiterLensItem['proofChallenge'] extends infer _T ? string : never) {
  switch (type) {
    case 'WORK_SAMPLE': return 'mise en situation / work sample';
    case 'STRUCTURED_QUESTION': return 'question structurée';
    case 'PORTFOLIO_EVIDENCE': return 'preuve portfolio';
    case 'CERTIFICATE_EVIDENCE': return 'preuve de certificat';
    case 'REFERENCE_EVIDENCE': return 'preuve par référence';
    default: return 'preuve complémentaire';
  }
}

export function RecruiterLensPanel({ items }: { items: RecruiterLensItem[] }) {
  return (
    <section className="recruiter-lens" aria-labelledby="recruiter-lens-heading">
      <div className="flow-panel-head">
        <span className="step-number">R</span>
        <div>
          <h3 id="recruiter-lens-heading">Recruiter Lens™</h3>
          <p>Lecture explicable des exigences et des preuves. Ce panneau ne prétend pas reproduire l’algorithme privé d’un employeur.</p>
        </div>
      </div>
      <div className="fact-grid">
        {items.map((item) => (
          <article className="fact-card recruiter-lens-card" data-testid={`recruiter-lens-${item.requirementId}`} key={item.requirementId}>
            <div>
              <strong>{item.requirement}</strong>
              <span>Priorité {item.priority} · {item.coverage}</span>
              {item.riskFlags.length ? <small>Risque : {item.riskFlags.join(' · ')}</small> : null}
              {item.proofChallenge ? (
                <small>Prochaine preuve : {challengeLabel(item.proofChallenge.type)}. Cette action ne transforme jamais automatiquement le GAP en compétence vérifiée.</small>
              ) : null}
              {item.doNotClaim.length ? <small>Ne pas revendiquer : {item.doNotClaim.join(', ')} tant qu’une preuve suffisante n’existe pas.</small> : null}
              {item.likelyQuestions.length ? <small>Question probable : {item.likelyQuestions[0]}</small> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
