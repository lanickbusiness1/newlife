# AfrIA Recruit™ Candidate OS™

Application opérationnelle canonique de `PRD-RECRUIT-001`.

## Statut vérifié — Candidate OS v1

Le vertical slice Candidate OS est **testé sur données synthétiques** dans la branche d’implémentation. Ce statut ne constitue ni une publication production, ni un M8 final, ni une certification Big4, ni une preuve de performance commerciale sur des candidats réels.

Parcours actuellement prouvé :

`Talent Passport™ → Diagnostic → Offre cible → Gap Matching → Evidence/Truth checks → Achievement Writer™ → CV ATS + CV humain → validation humaine → Interview Coach™ → dossier de candidature non envoyé → outcome candidat non confirmé`

## Frontières

- `apps/afria-recruit/` : parcours candidat opérationnel authentifié.
- `apps/afria-recruit-investor-demo/` : démonstration publique séparée et sans données personnelles.
- `apps/web/` : GDIZ Smart Service Node, hors périmètre Recruit.
- `supabase/` : couche de données canonique partagée.

## Invariants de vérité

- Un fait déclaré ne devient jamais vérifié par simple génération IA.
- Un `GAP` reste un manque ; aucun mot-clé d’offre n’est ajouté comme compétence candidat sans preuve.
- Les réécritures n’inventent aucun chiffre ; seules les métriques explicitement sourcées peuvent être utilisées.
- Les variantes ATS et humaines partagent le même fingerprint factuel.
- Une validation humaine confirmée est obligatoire avant création du package de candidature.
- La création d’un package n’envoie rien : `status=started`, `applied_at=null`, aucune méthode d’auto-submit.
- Un outcome déclaré par le candidat reste `unconfirmed` et ne modifie pas automatiquement le statut officiel de la candidature.
- Les réponses brutes d’entraînement à l’entretien ne sont pas persistées en clair par Candidate OS v1 ; seul le feedback structuré est conservé.

## Sécurité

Les clés privilégiées sont exclusivement serveur. Le navigateur ne reçoit qu’une URL publique et une clé publiable. Toute écriture privilégiée suit l’ordre : authentification du bearer token → preuve d’appartenance du profil candidat via le chemin utilisateur/RLS → seulement ensuite construction du client privilégié.

Le runtime synthétique E2E n’est activable que lorsque `CI=true`, `GITHUB_ACTIONS=true` et `AFRIA_RECRUIT_E2E_MODE=1` sont simultanément présents.

## IA

L’adaptateur IA externe est optionnel. Sans configuration fournisseur valide, Candidate OS utilise un moteur déterministe qui conserve toutes les règles de vérité. Les classifications de preuves et de gaps restent déterministes même lorsqu’un fournisseur IA est activé.

## Variables d’environnement

Copier `.env.example` vers un fichier local non versionné et renseigner uniquement les valeurs nécessaires. Aucun secret réel ne doit être commité.

## Vérification locale

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npm run test:unit
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm run scan:source
npm run scan:build
```

Le workflow `.github/workflows/afria-recruit-candidate-os.yml` applique ces gates sur la branche et les pull requests Candidate OS.

## Preuves

Voir :

- `docs/evidence-matrix.md`
- `docs/release-verification.md`
