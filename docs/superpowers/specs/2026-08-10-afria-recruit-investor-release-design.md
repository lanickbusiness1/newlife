# AfrIA Recruit Investor Release — Design

## Autorité canonique

- Produit : AfrIA Recruit™
- Canonical Asset ID : `PRD-RECRUIT-001`
- Page Notion : `343cdd91-020e-81bc-9106-f7de5049ab40`
- Niveau actuel : `TEST_PROVEN`, production non autorisée
- Objet de ce changement : staging investisseur rattaché au produit existant, sans nouveau produit ni nouveau moteur autonome

## Problème à corriger

Le dépôt contient trois surfaces concurrentes : une application Vite connectée à Supabase, une page investisseur premium statique et une ancienne page de repli. Les tests UI ont été séparés de l’application déployable, quatre contrôles KPI ont été supprimés pour obtenir un pipeline vert, et le workflow Pages pouvait tenter de déployer sans attendre les tests. GitHub Pages n’est pas encore activé pour le dépôt.

## Décisions de conception

1. `apps/afria-recruit-investor-demo` devient l’unique source du staging investisseur.
2. Les fonctions utiles de la page premium — identité AfrIAgenesis®, scénario interactif, assistant explicatif, CTA WhatsApp, responsive — sont intégrées dans cette application Vite.
3. Les KPI restent chargés par `loadInvestorKpis()` depuis le RPC Supabase `investor_demo_kpis`. Une indisponibilité produit un mode dégradé explicitement libellé, jamais de faux claim live.
4. La clé navigateur Supabase est traitée comme publique. Aucun `service_role`, secret serveur ou donnée personnelle ne doit être présent dans la source ou le bundle.
5. Un seul workflow `AfrIA Recruit Canonical Release` exécute dans l’ordre : installation déterministe, tests unitaires et SQL, build de production, tests E2E de ce même répertoire immuable, audit de secrets, création de l’artefact Pages, déploiement si Pages existe, puis smoke test HTTP.
6. Les trois workflows historiques AfrIA Recruit et le workflow Pages concurrent Startup Accelerator sont retirés afin d’éliminer les doubles exécutions et les écrasements de site. L’Accelerator est préservé dans l’artefact unique sous `/startup-accelerator/`; les anciennes pages Recruit restent des archives non publiées.
7. Le staging ne prétend pas être le produit Next.js/PWA production verrouillé dans Notion. Il constitue une preuve investisseur connectée et contrôlée.
8. Le RPC `investor_demo_kpis` est versionné dans le dépôt et n’agrège que les enregistrements ayant franchi les gates métier. Sa fonction `SECURITY DEFINER` fixe un `search_path` vide et limite explicitement l’exécution à `anon` et `authenticated`.
9. La concurrence est gérée au niveau du workflow et annule tout run plus ancien sur la même ref ; un artefact obsolète ne peut donc pas passer après une release plus récente.

## Composants

- `src/kpi.js` : normalisation des données du RPC et mode dégradé.
- `src/assistant.js` : réponses déterministes et sûres de l’assistant investisseur.
- `src/main.js` : orchestration data/UI et interactions.
- `index.html` : structure sémantique, marque, KPI, scénario, assistant et CTA.
- `src/styles.css` : design chaud africain, responsive et accessibilité.
- `test/*.test.js` : contrats unitaires data et assistant.
- `e2e/investor.spec.js` : preuve navigateur du chargement KPI, des interactions, de la confidentialité visible et du responsive.
- `scripts/scan-public-bundle.mjs` : refus des secrets serveur, anciens claims inventés et source maps.
- `scripts/package-pages.mjs` : paquet Pages unique et manifeste lié au SHA.
- `supabase/migrations/20260810094242_secure_investor_demo_kpis.sql` : contrat SQL auditable des agrégats publics.
- `test/migration.test.js` : exécution du SQL sur PostgreSQL embarqué, privilèges et métriques vérifiées.

## Critères d’acceptation

- `npm ci`, `npm test`, `npm run build` et `npm run test:e2e` réussissent.
- Les empreintes du répertoire `dist/` sont identiques avant et après les E2E.
- Le test E2E intercepte le RPC et prouve l’affichage `12 / 3 / 7 / 2`, plus le pipeline calculé.
- Le mode dégradé est visible et ne se présente jamais comme donnée actualisée.
- Logo, assistant, WhatsApp, scénario et validation humaine sont fonctionnels.
- Aucun mot technique interdit ni credential serveur n’est visible dans l’interface.
- Le bundle ne contient ni `service_role`, ni `SUPABASE_SERVICE`, ni clé privée.
- Le job de déploiement dépend du job de vérification et ne s’exécute que si l’API confirme que Pages est activé, ou sur dispatch forcé explicite.
- L’URL finale répond HTTP 200 et contient `AfrIA Recruit` ; `release.json` expose SHA et date de build.

## Rollback et preuves

Chaque release Pages est liée au SHA Git. Le rollback consiste à redéployer le dernier SHA vert. Les artefacts CI, résultats unitaires/E2E, smoke test et URL sont les preuves minimales. Sans Pages activé ou sans smoke test, le verdict reste `NO-GO production`.

## Hors périmètre

Le présent correctif ne remplace pas le build complet Next.js/PWA, n’ajoute pas de paiement et ne traite pas de données candidats réelles. Il ne modifie que le RPC agrégé public nécessaire à la preuve investisseur ; le reste du schéma demeure sous le blueprint production de `PRD-RECRUIT-001`.
