# AfrIA Recruit Investor Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un staging investisseur AfrIA Recruit unique, connecté, testé et déployable uniquement après réussite de tous les contrôles.

**Architecture:** L’application Vite existante devient la source canonique du staging. Les modules purs portent les KPI et l’assistant ; le navigateur orchestre ces modules et les interactions. Un workflow GitHub Actions unique produit et déploie exactement l’artefact vérifié.

**Tech Stack:** Vite 7, JavaScript ESM, Supabase JS, Node.js 24, Node Test Runner, Playwright, GitHub Actions et GitHub Pages.

## Global Constraints

- Ne créer aucun nouveau produit : rattachement obligatoire à `PRD-RECRUIT-001`.
- Aucun secret serveur, aucune donnée candidat réelle et aucun claim live non prouvé.
- TDD obligatoire : chaque comportement nouveau doit être observé en échec avant implémentation.
- Le déploiement dépend obligatoirement des tests, du build, de l’E2E et du scan de bundle.
- L’ancienne interface reste une archive non publiée jusqu’à décision d’archivage séparée.

---

### Task 1: Contrats data et assistant

**Files:**
- Modify: `apps/afria-recruit-investor-demo/test/kpi.test.js`
- Create: `apps/afria-recruit-investor-demo/test/assistant.test.js`
- Create: `apps/afria-recruit-investor-demo/src/assistant.js`

**Interfaces:**
- Consumes: `loadInvestorKpis(supabase)`
- Produces: `answerInvestorQuestion(question)` et `createWelcomeMessage()`

- [ ] Écrire les tests de normalisation, pipeline, mode dégradé et réponses de l’assistant.
- [ ] Exécuter `npm test` et vérifier l’échec attendu pour le module assistant absent.
- [ ] Implémenter le minimum dans `src/assistant.js`.
- [ ] Exécuter `npm test` et obtenir zéro échec.
- [ ] Commit : `test(afria-recruit): restore governed data and assistant contracts`.

### Task 2: Preuve E2E restaurée — phase rouge

**Files:**
- Modify: `apps/afria-recruit-investor-demo/package.json`
- Create: `apps/afria-recruit-investor-demo/playwright.config.js`
- Create: `apps/afria-recruit-investor-demo/e2e/investor.spec.js`
- Create: `apps/afria-recruit-investor-demo/package-lock.json`

**Interfaces:**
- Consumes: bundle Vite servi par `npm run preview`
- Produces: commande `npm run test:e2e` et contrat DOM attendu

- [ ] Ajouter Playwright et les scripts `check` et `test:e2e`.
- [ ] Tester le RPC mocké et exiger `12`, `3`, `7`, `2` et pipeline `10`.
- [ ] Tester mode dégradé, assistant, scénario, WhatsApp, confidentialité visible et viewport mobile.
- [ ] Exécuter la suite sur la page historique et conserver la preuve de l’échec fonctionnel attendu.
- [ ] Générer et committer le lockfile npm avec les tests rouges.
- [ ] Commit : `test(afria-recruit): restore connected investor e2e contract`.

### Task 3: Interface premium connectée — phase verte

**Files:**
- Modify: `apps/afria-recruit-investor-demo/index.html`
- Modify: `apps/afria-recruit-investor-demo/src/main.js`
- Modify: `apps/afria-recruit-investor-demo/src/styles.css`

**Interfaces:**
- Consumes: `loadInvestorKpis`, `answerInvestorQuestion`, `createWelcomeMessage`
- Produces: DOM stable `#candidates`, `#needs`, `#matches`, `#placements`, `#pipeline`, `#data-status`, `#assistant-panel`, `#interactive-demo`

- [ ] Remplacer la structure minimale par la page premium AfrIAgenesis®.
- [ ] Brancher les KPI réels ou le mode dégradé transparent.
- [ ] Brancher scénario, revue humaine, assistant, navigation et WhatsApp.
- [ ] Exécuter `npm test`, `npm run build` et `npm run test:e2e` jusqu’à zéro échec.
- [ ] Vérifier manuellement les vues desktop et mobile avec le bundle produit.
- [ ] Commit : `feat(afria-recruit): unify connected investor experience`.

### Task 4: Pipeline release unique et durci

**Files:**
- Create: `.github/workflows/afria-recruit-release.yml`
- Delete: `.github/workflows/afria-recruit-investor-demo.yml`
- Delete: `.github/workflows/afria-recruit-investor-page.yml`
- Delete: `.github/workflows/afria-recruit-pages.yml`
- Delete: `.github/workflows/deploy-startup-accelerator-genome.yml`
- Create: `apps/afria-recruit-investor-demo/scripts/scan-public-bundle.mjs`
- Create: `apps/afria-recruit-investor-demo/scripts/package-pages.mjs`
- Create: `docs/operations/AFRIA_RECRUIT_RELEASE_RUNBOOK.md`

**Interfaces:**
- Consumes: `npm ci`, `npm run check`, `dist/`
- Produces: artefact Pages, `release.json`, URL et smoke test

- [ ] Écrire le scanner et son test avant le workflow.
- [ ] Créer un job `verify` Node 24 : install, unit, build, E2E, scan.
- [ ] Créer un job `package-pages` dépendant de `verify`.
- [ ] Créer un job `deploy` dépendant de l’artefact vérifié et de l’activation Pages détectée par API.
- [ ] Ajouter le smoke test post-déploiement et le runbook de rollback.
- [ ] Retirer les quatre workflows concurrents et préserver Accelerator sous un sous-chemin.
- [ ] Valider la syntaxe YAML et les chemins.
- [ ] Commit : `ci(afria-recruit): gate one canonical release pipeline`.

### Task 5: Livraison GitHub et contrôle public

**Files:**
- Modify only if CI evidence requires a focused correction.

**Interfaces:**
- Consumes: branche `fix/afria-recruit-release`
- Produces: PR, checks verts, Pages actif, URL HTTP 200

- [ ] Exécuter fraîchement `npm ci`, `npm test`, `npm run build`, `npm run test:e2e` et le scan.
- [ ] Pousser la branche et ouvrir une PR avec preuves.
- [ ] Inspecter chaque job GitHub Actions et corriger uniquement la cause observée.
- [ ] Activer Pages avec Source=`GitHub Actions` si l’outil authentifié le permet.
- [ ] Fusionner après contrôles verts, surveiller le run `main` et vérifier l’URL.
- [ ] Exécuter M8, contre-revue Big4, puis mettre à jour la page Notion canonique avec SHA, URL et verdict.
