# AfrIA Recruit™ Candidate OS v1 — Release Verification

## Identité

- Produit : `PRD-RECRUIT-001`
- Application canonique : `apps/afria-recruit/`
- Branche : `feat/afria-recruit-candidate-os-v1`
- Date : 2026-08-16
- Head applicatif + migration vérifié avant cette fermeture documentaire : `87360504a9042f6d1da531f67f6130badca6366b`
- GitHub Actions Candidate OS : `31956668880` — SUCCESS
- GitHub Actions Canonical Release : `31956668877` — SUCCESS
- Migration Supabase appliquée : `20260816154659_harden_candidate_disclosure_rbac`

## Résultats observés — application

Le run `31956668880` a exécuté avec succès :

1. `npm ci --ignore-scripts`
2. `npm audit --audit-level=high` — **0 vulnérabilité**
3. `npm run test:unit` — **49 tests réussis, 0 échec**
4. `npm run typecheck` — **PASS**
5. `npm run build` — **PASS**
6. installation Chromium Playwright — **PASS**
7. `npm run test:e2e` — **8 tests navigateur réussis, 0 échec**
8. `npm run scan:source` — **PASS**
9. `npm run scan:build` — **PASS**

Les tests navigateur couvrent le parcours CV Optimizer, mobile 390×844, clavier, Interview Coach, package sans auto-envoi, outcome non confirmé, erreurs API sûres et refus du traitement externe sans consentement explicite.

## Résultats observés — sécurité / RLS live

Les contrôles RLS ont été exécutés sur le projet Supabase canonique avec des identités et données **strictement synthétiques**, toujours enfermées dans des transactions avec `ROLLBACK`.

### Isolation candidat

- candidat A voit uniquement le candidat A parmi deux fixtures A/B : **PASS** ;
- candidat A voit uniquement l’expérience A : **PASS** ;
- tentative d’update du candidat B par A : **0 ligne affectée** ;
- après rollback : **0 auth user, 0 candidat, 0 expérience synthétique résiduelle** ;
- rôle `anon` : aucun `SELECT` sur les 15 tables Candidate OS contrôlées ; lecture `candidates` rejetée par `permission denied`.

### Disclosure institutionnelle — RED puis GREEN

Le test initial a révélé un défaut de least privilege : un membre organisationnel `billing` devenait capable de lire le candidat et ses faits après consentement `institution_disclosure`.

Correctif versionné : `supabase/migrations/20260816154500_harden_candidate_disclosure_rbac.sql`.

La migration crée la capability privée `private.can_receive_candidate_disclosure(uuid)` limitée aux rôles actifs :

- `hiring_manager`
- `recruiter`
- `admin`

Elle durcit `private.can_access_candidate`, `consents_select` et `disclosure_select` sans modifier le helper générique `is_org_member()` utilisé par les flux billing/opérations.

Test live après migration :

- `recruiter` sans consentement : candidat **0**, expérience **0**, consentement **0** ;
- `billing` avec consentement : candidat **0**, expérience **0**, consentement **0** ;
- `recruiter` avec consentement : candidat **1**, expérience **1**, consentement **1** ;
- rollback final : **0 fixture résiduelle**.

## Advisor Supabase post-DDL

Security Advisor après migration :

- **0 ERROR** ;
- **1 INFO** : `private.audit_events` a RLS activé et aucune policy publique ;
- **2 WARN** : `public.investor_demo_kpis()` est volontairement `SECURITY DEFINER` et exécutable par `anon` / `authenticated` pour le démonstrateur agrégé public.

Ces deux WARN appartiennent au contrat du démonstrateur investisseur ; ils ne donnent aucun accès aux lignes candidat.

## Propriétés prouvées

- Authentification et ownership précèdent toute élévation de privilège.
- La session navigateur live est portée par un cookie `HttpOnly`, `SameSite=Strict`; aucun bearer n’est conservé dans `localStorage` ou `sessionStorage`.
- Les composants client ne référencent pas les secrets serveur.
- Un besoin non couvert reste `GAP`.
- La réécriture n’introduit pas de métrique non sourcée.
- Aucun texte CV n’est envoyé à un fournisseur IA externe sans consentement explicite auditable ; sinon fallback déterministe.
- ATS et CV humain partagent un fingerprint factuel identique.
- La revue humaine est un gate avant création de package.
- Aucune fonction d’auto-submit n’est présente dans Candidate OS v1.
- Les réponses brutes d’entraînement ne sont pas persistées en clair par ce lot.
- Un outcome candidat reste non confirmé tant qu’aucune preuve externe ne le confirme.
- L’isolation RLS candidat A/B est prouvée sur la base live avec rollback.
- Un membre `billing` ne reçoit plus le Talent Passport™ via un consentement institutionnel.

## Ce qui n’est pas prouvé

- Aucun déploiement production n’est revendiqué.
- Aucun staging public/authentifié permanent n’est encore revendiqué.
- Aucun M8 final n’est revendiqué.
- Aucune certification Big4 ou revue indépendante externe n’est revendiquée.
- Aucun taux d’entretien, d’offre ou d’embauche réel n’est revendiqué.
- Aucun test sur données personnelles de candidats réels n’a été utilisé comme preuve de ce lot.
- Le futur portail recruteur/job-assignment n’est pas inclus dans Candidate OS v1.

## Gate suivant

Staging authentifié avec comptes de test autorisés → revue sécurité indépendante → M6/S7+/M8 → décision explicite de fusion/publication.

---

## Checkpoint 24 août 2026 — Verified Learning & Credential Intelligence Engine™

**Périmètre :** capacité P0 interne de `PRD-RECRUIT-001`, sans nouveau produit et sans nouveau schéma de données.  
**Branche de preuve :** `feat/afria-recruit-ats-readiness-p0`.  
**PR :** `#48`.  
**Implémentation finale vérifiée :** `3c0fd2ab09fc1f1e79a869d6e326e1aab2dc5f49`.

### TDD observé

- RED `#192` — commit `56a24c82d9b4792f24e73c8ff4fc19001cffe591` : compilation de test échoue car le moteur n’existe pas encore.
- GREEN `#193` — commit `d710a548926e1a628248c1521e64413e569558b9` : premier cœur déterministe vert sur tout le workflow.
- RED hardening `#194` — commit `469a5789cd71868833f909f3cbe0f30b2a9772ce` : **83/84**, seul échec = source obsolète encore acceptée.
- GREEN final `#195` — commit `3c0fd2ab09fc1f1e79a869d6e326e1aab2dc5f49` : **84/84 unit tests**, **0 vulnérabilité npm**, typecheck PASS, build Next.js PASS, **8/8 Playwright**, source scan PASS, public bundle scan PASS.

### Contrats désormais prouvés

- distinction entre learning gratuit et credential gratuit ;
- country/language/sector eligibility fail-closed ;
- provenance primaire obligatoire ;
- assessment requis vérifié ;
- politique de fraîcheur des sources avec `EVIDENCE_STALE` ;
- détection du claim trompeur « certification gratuite » quand le credential est payant ;
- normalisation conservative des skills ;
- job-gap-to-course matching sans création de claim candidat ;
- ranking déterministe intégrant gap closure, vérifiabilité, coût, durée et risque trompeur ;
- aucun score publié si un hard gate échoue ;
- completion credential vérifiée → skill `credential-evidenced` + provenance dans une copie immuable du Talent Passport™ ;
- employability delta borné et explicite.

### Verdict

**M6 CORE TEST_PROVEN** pour le cœur déterministe de **Verified Learning & Credential Intelligence Engine™**.

Ce statut **ne ferme pas** le M6 live/global de la release et ne vaut pas `S7+ PASS`, `M8 PASS`, revue Big4/indépendante, staging permanent, déploiement production ou performance réelle candidat.

### Prochaine frontière obligatoire

Exécuter le cas live autorisé et sourcé :

`1 offre réelle + 1 candidat réel autorisé + ≥3 opportunités d’apprentissage récupérées depuis sources primaires → gates éligibilité/provenance/fraîcheur → ranking → completion credential simulée → Talent Passport™ vNext → readiness/employability delta → preuves S7+/M8`.

Décision : **GO poursuite / HOLD release production**.
