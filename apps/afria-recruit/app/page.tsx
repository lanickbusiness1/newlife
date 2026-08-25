const capabilities = [
  ['01', 'Diagnostiquer', 'Identifier les faiblesses du CV sans inventer de faits.'],
  ['02', 'Cibler', 'Comparer le Talent Passport™ aux exigences d’une opportunité réelle.'],
  ['03', 'Prouver', 'Distinguer ce qui est déclaré, documenté et vérifié.'],
  ['04', 'Préparer', 'Réécrire avec prudence puis s’entraîner à l’entretien.'],
];

export default function HomePage() {
  return (
    <main>
      <header className="nav shell">
        <div className="brand" aria-label="AfrIAgenesis">
          <span className="brand-mark">A</span>
          <span><strong>AfrIA</strong>genesis®</span>
        </div>
        <span className="status">Candidate OS™ · construction gouvernée</span>
      </header>

      <section className="hero shell">
        <p className="eyebrow">AfrIA Recruit™</p>
        <h1>Votre carrière devient un système de preuves, pas une collection de prompts.</h1>
        <p className="lead">
          CV, compétences, offre cible, preuves, préparation d’entretien et suivi de candidature sont reliés dans un même parcours, avec validation humaine à chaque décision sensible.
        </p>
        <div className="actions">
          <span className="primary" aria-disabled="true">Optimiser mon CV · bientôt disponible</span>
          <span className="secondary">Aucune promesse de résultat inventée</span>
        </div>
      </section>

      <section className="shell section" aria-labelledby="capabilities-title">
        <p className="eyebrow">Candidate Career Intelligence Flow™</p>
        <h2 id="capabilities-title">Une chaîne cohérente de la preuve à l’opportunité.</h2>
        <div className="grid">
          {capabilities.map(([number, title, copy]) => (
            <article className="card" key={number}>
              <span className="number">{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell trust">
        <div><strong>Vérité</strong><span>Aucun chiffre ou savoir-faire ajouté sans base factuelle.</span></div>
        <div><strong>Consentement</strong><span>Le candidat contrôle les usages et le partage de son profil.</span></div>
        <div><strong>Décision humaine</strong><span>L’IA assiste ; elle ne valide ni l’embauche ni la candidature seule.</span></div>
      </section>

      <footer className="shell footer">AfrIA Recruit™ · produit AfrIAgenesis® · application opérationnelle en cours de construction</footer>
    </main>
  );
}
