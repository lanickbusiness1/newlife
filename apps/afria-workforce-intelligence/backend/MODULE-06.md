# MODULE 06 — Mining Local Content, Workforce & Value Retention Intelligence

**Canonical parent:** BP-MINING-GN-001 — AfrIAgenesis® Sovereign Mining OS™ Guinée  
**Version:** BP-MINING-GN-001 / MODULE-06 / v1.0-DOCUMENTED  
**Build branch:** `feature/mining-local-content-module-06`  
**Technical status:** source and migration implemented; not deployed; not production-certified.

## Implemented in this increment

- sourced and versioned legal-rule object;
- mandatory human `LEGAL_APPROVER` gate;
- mining workforce records by project, category and nationality status;
- national/expatriate headcount ratio;
- target gap and evidence-coverage calculation;
- explicit `NO_DATA` result instead of false compliance;
- advisory-only assessments;
- tenant and mining-project isolation;
- succession readiness calculation;
- mandatory human `HR_APPROVER` gate for succession-plan approval;
- PostgreSQL/Supabase schema with row-level security.

## Security and governance invariants

1. A draft legal rule cannot be evaluated.
2. An AI agent cannot validate a legal rule.
3. An AI agent cannot approve a succession plan.
4. A rule source must have identity, title, HTTPS URL, jurisdiction, version and effective date.
5. A rule can only be applied to the same tenant jurisdiction.
6. Workforce records cannot cross tenant or mining-project boundaries.
7. Assessments are labelled `ADVISORY`; the engine never certifies legal compliance.
8. Empty datasets return `NO_DATA`.
9. No real employee data, secrets, biometrics or production credentials are present in the repository.

## Verification performed

Local isolated verification on Node.js 22:

```bash
node --loader /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/esm.mjs --test tests/*.test.ts
tsc --noEmit --typeRoots /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/node_modules/@types
```

Observed result:

- 8 tests passed;
- 0 tests failed;
- strict TypeScript type-check passed.

The GitHub pull-request workflow remains the authoritative remote verification:

```bash
npm install
npm run typecheck
npm test
```

## Database assets

Migration `database/002_mining_local_content.sql` adds:

- `mining_projects`;
- `local_content_legal_sources`;
- `local_content_rules`;
- `mining_workforce_records`;
- `local_content_assessments`;
- `succession_plans`;
- tenant-isolation RLS policies and operational indexes.

## Open gates

- **G0 Legal Source Gate:** replace test legal-source metadata with verified Guinean primary sources and legal validation evidence.
- **G1 Data Gate:** define the official HR/ERP/import templates and data-quality controls.
- **G2 API Gate:** expose authenticated command/query endpoints with RBAC/ABAC.
- **G3 E2E Gate:** ingest a synthetic mining workforce dataset and reproduce an assessment plus succession workflow.
- **G4 M6/S7+ Gate:** code, threat-model, privacy and rollback review.
- **G5 M8 Gate:** internal governance decision.
- **G6 External Gate:** legal and Big4-type review before institutional production use.

## Next build increment

Add application services and API contracts for:

1. legal-source registration and human validation;
2. workforce-record ingestion;
3. compliance assessment execution and evidence persistence;
4. succession-plan creation and approval;
5. Mission Control snapshot and audit export.

No production, commercial or legal-certification claim is authorized until all gates close with evidence.
