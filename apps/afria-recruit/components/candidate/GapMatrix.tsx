import type { RequirementCoverage } from '../../lib/domain/types.js';

export function GapMatrix({ rows }: { rows: RequirementCoverage[] }) {
  return (
    <div className="gap-matrix" role="table" aria-label="Matrice exigences et preuves">
      <div className="gap-head" role="row">
        <span role="columnheader">Exigence</span><span role="columnheader">Couverture</span><span role="columnheader">Explication</span>
      </div>
      {rows.map((row) => (
        <div className="gap-row" role="row" key={row.requirementId} data-testid={`gap-row-${row.requirementId}`}>
          <strong role="cell">{row.requirement}</strong>
          <span role="cell" className={`coverage coverage-${row.coverage.toLowerCase()}`}>{row.coverage}</span>
          <span role="cell">{row.explanation}</span>
        </div>
      ))}
    </div>
  );
}
