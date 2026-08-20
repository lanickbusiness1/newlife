import type { DiagnosticFinding } from '../../lib/domain/types.js';

export function DiagnosticPanel({ findings }: { findings: DiagnosticFinding[] }) {
  return (
    <section className="flow-panel" aria-labelledby="diagnostic-heading">
      <div className="flow-panel-head">
        <span className="step-number">02</span>
        <div><h2 id="diagnostic-heading">Diagnostic</h2><p>Priorités détectées sans certification ATS universelle.</p></div>
      </div>
      {findings.length === 0 ? <p className="success-copy">Aucune anomalie structurelle détectée sur les faits disponibles.</p> : (
        <ul className="finding-list">
          {findings.map((finding) => (
            <li key={finding.code} className={`finding ${finding.severity}`}>
              <strong>{finding.blocking ? 'Bloquant' : finding.severity === 'warning' ? 'À corriger' : 'À renforcer'}</strong>
              <span>{finding.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
