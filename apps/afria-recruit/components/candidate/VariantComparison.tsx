import type { VariantsResponse } from '../../lib/http/api-client.js';

function ExperienceList({ sections }: { sections: VariantsResponse['variants']['ats']['sections'] }) {
  return (
    <ul className="variant-list">
      {sections.experiences.map((experience, index) => (
        <li key={index}>
          <strong>{String(experience.title ?? '')}</strong>
          <span>{String(experience.organization ?? '')}</span>
          {experience.description ? <p>{String(experience.description)}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function VariantComparison({ variants }: { variants: VariantsResponse['variants'] }) {
  return (
    <div className="variant-grid">
      <article className="candidate-card variant-card">
        <span className="candidate-kicker">Lecture machine simplifiée</span>
        <h3>CV ATS</h3>
        <p className="variant-headline">{variants.ats.sections.headline}</p>
        <ExperienceList sections={variants.ats.sections} />
        <code data-testid="ats-fingerprint">{variants.ats.factsFingerprint}</code>
      </article>
      <article className="candidate-card variant-card human">
        <span className="candidate-kicker">Lecture recruteur</span>
        <h3>CV humain</h3>
        <p className="variant-headline">{variants.human.sections.headline}</p>
        <ExperienceList sections={variants.human.sections} />
        <code data-testid="human-fingerprint">{variants.human.factsFingerprint}</code>
      </article>
    </div>
  );
}
