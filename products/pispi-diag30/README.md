# PI-SPI Readiness Checker™ — DIAG30 v2.1 / AESS™

Moteur et API de scoring pour le diagnostic de préparation PI-SPI d’AfrIAgenesis®.

## Périmètre livré

- registre contractuel de 30 questions ;
- réponses `NON_RENSEIGNE`, `NON`, `PARTIEL`, `DOCUMENTE` ;
- score brut sur 120 et normalisation sur 100 ;
- statuts `NOT_READY`, `HIGH_RISK`, `CONDITIONALLY_READY`, `READY_WITH_CONTROLS`, `STRATEGICALLY_READY` ;
- sous-score économique et AESS™ pondéré ;
- gates bloquants I1, I2 et I4 ;
- gate de preuve pour le statut stratégique ;
- cinq sous-scores : technique, réglementaire, opérationnel, économique et écosystème ;
- persistance JSON de sessions avec reprise ;
- rapport structuré et clause de non-certification BCEAO ;
- consentement explicite avant préparation d’une demande de preuves ;
- API HTTP native Node.js, sans dépendance externe ;
- tests unitaires et d’intégration.

## Exécution

```bash
cd products/pispi-diag30
npm run check
npm test
npm start
```

Le serveur écoute `PORT` ou, par défaut, le port `3000`.

## Contrat API

- `GET /health`
- `POST /api/v1/diagnostics`
- `PUT /api/v1/diagnostics/{id}/answers`
- `POST /api/v1/diagnostics/{id}/score`
- `GET /api/v1/diagnostics/{id}/report`
- `POST /api/v1/diagnostics/{id}/lead-consent`
- `POST /api/v1/diagnostics/{id}/evidence-request`

Les données sont écrites par défaut dans `data/diagnostics.json`. La couche `DiagnosticStore` accepte un chemin différent pour les tests ou une future adaptation PostgreSQL/Supabase.

## Exemple moteur

```js
import { createAnswer, scoreDiagnostic } from './src/engine.js';
import { QUESTIONS } from './src/questions.js';

const answers = QUESTIONS.map(({ id }) => createAnswer(id, 'DOCUMENTE'));
const result = scoreDiagnostic(answers, { evidenceGatePassed: true });
console.log(result);
```

## Contrat de sécurité fonctionnelle

Le moteur ne déduit jamais une réponse manquante. Une question critique non renseignée bloque tout verdict positif. `STRATEGICALLY_READY` exige simultanément un score global d’au moins 90, un AESS™ d’au moins 90 et le passage explicite du gate de preuves.

La demande de passage vers l’audit probant est refusée tant qu’un consentement explicite n’a pas été enregistré.

## Clause impérative

Le PI-SPI Readiness Checker™ est un outil indépendant de diagnostic et de préparation. Il ne constitue ni un agrément, ni une certification de la BCEAO, ni une confirmation de participation ou de connexion à PI-SPI.

## Reste avant preview publique

Interface web DIAG30, accessibilité complète, stockage de production, authentification d’administration, protection anti-abus, journal d’audit externalisé, génération PDF, E2E navigateur, headers de sécurité, preview Netlify et rollback vérifié.
