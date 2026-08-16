# AfrIA Recruit™ Candidate OS v1 — Evidence Matrix

Date de contrôle : 2026-08-16  
Produit canonique : `PRD-RECRUIT-001`  
Application : `apps/afria-recruit/`  
Baseline vérifiée avant fermeture documentaire : GitHub Actions run `31952603178`.

| Exigence | Implémentation principale | Preuve automatisée | Statut |
|---|---|---|---|
| Application opérationnelle séparée | `apps/afria-recruit/` | scaffold contract + build Next.js | PASS |
| Aucune réutilisation GDIZ/investor demo | frontières README + arborescence dédiée | scaffold/privacy contracts | PASS |
| Auth avant privilège | `lib/auth/authenticated-user.ts` | `auth-boundary.test.ts` | PASS |
| Ownership candidat avant service-role | `requireAuthenticatedCandidate()` | ordre `auth → ownership → admin` | PASS |
| Service-role absent du client | `lib/supabase/admin-client.ts`, scanner source | `privacy-contract.test.ts` + `scan:source` | PASS |
| Talent Passport existant réutilisé | repositories live/fixture | `repository-contract.test.ts` | PASS |
| Pas de DDL nouveau | schéma existant réutilisé | revue de code / absence de migration Candidate OS | PASS |
| Evidence DECLARED/EVIDENCED/VERIFIED | `lib/domain/evidence.ts` | `domain.test.ts` | PASS |
| GAP jamais transformé en claim | `lib/domain/gap-matching.ts` | domain + AI adapter + Playwright | PASS |
| Contradictions chronologiques bloquantes | `truth-consistency.ts` | `domain.test.ts` | PASS |
| Aucun chiffre inventé | `achievement-writer.ts`, `validators.ts` | domain + AI adapter tests | PASS |
| Sorties IA structurées et validées | `lib/ai/*` | `ai-adapter.test.ts` | PASS |
| Fallback déterministe | `deterministic-adapter.ts`, `ai/index.ts` | AI adapter tests | PASS |
| Persistance alignée schéma live | `persist-decision.ts` | live persistence contract test | PASS |
| API erreurs sûres | `lib/http/errors.ts` | unit + `security.spec.ts` | PASS |
| Requête non authentifiée = 401 | auth boundary + HTTP wrapper | `security.spec.ts` | PASS |
| CV ATS / humain même faits | `buildVariants()` | unit + Playwright fingerprints | PASS |
| Validation humaine obligatoire | optimizer/review service | optimizer service + E2E | PASS |
| Mobile 390×844 sans overflow | CSS + optimizer UI | Playwright mobile test | PASS |
| Navigation clavier essentielle | optimizer UI | Playwright keyboard test | PASS |
| Consentement entretien explicite | `InterviewService`, consent store | interview/application unit + E2E | PASS |
| Réponse brute entretien non persistée | `InterviewService.respond()` | unit contract + UI E2E | PASS |
| Feedback entretien contextualisé | AI adapter + InterviewService | unit + E2E | PASS |
| Package interdit sans review confirmée | `ApplicationService.createPackage()` | unit contract | PASS |
| Package sans auto-submit | application service | exact insert contract + E2E | PASS |
| `status=started`, `applied_at=null` | `buildStartedApplicationInsert()` | unit contract | PASS |
| Outcome candidat non confirmé | `ApplicationService.recordCandidateOutcome()` | unit + E2E | PASS |
| Outcome ne change pas le statut officiel | application event store | unit + E2E | PASS |
| Anti-PII fixtures | fixture repository + scanner | privacy contract + `scan:source` | PASS |
| Anti-secret public bundle | `scan-build.mjs` | CI `scan:build` | PASS |
| Dépendances verrouillées | `package-lock.json`, `npm ci` | CI | PASS |
| Audit dépendances | npm audit high | CI : 0 vulnérabilité | PASS |
| Production build | Next.js 16 Webpack | CI | PASS |
| Tests unitaires | `tests/unit/*` | 39/39 PASS | PASS |
| Tests navigateur | `tests/e2e/*` | 7/7 PASS | PASS |
| M6/S7+/M8 final | hors de ce lot | aucun verdict final déclaré | NOT-YET-GATED |
| Revue Big4 / indépendante | hors de ce lot | non exécutée | NOT-YET-GATED |
| Déploiement production | hors de ce lot | aucune URL production revendiquée | NOT-YET-GATED |
| Performance réelle candidats | nécessite échantillon réel autorisé | aucune métrique inventée | NOT-YET-GATED |

## Verdict de preuve

`CODE + SYNTHETIC E2E = TEST_PROVEN`

Ce verdict signifie que le vertical slice est reproductible et testé sur fixtures synthétiques. Il ne signifie pas `PRODUCTION`, `M8 PASS`, `BIG4 PASS` ni efficacité commerciale prouvée.
