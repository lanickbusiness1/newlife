# PI-SPI Readiness Checker™ — DIAG30 v2.1 / AESS™

Moteur autonome de scoring pour le diagnostic de préparation PI-SPI d’AfrIAgenesis®.

## Périmètre livré

- registre contractuel de 30 questions ;
- réponses `NON_RENSEIGNE`, `NON`, `PARTIEL`, `DOCUMENTE` ;
- score brut sur 120 et normalisation sur 100 ;
- statuts `NOT_READY`, `HIGH_RISK`, `CONDITIONALLY_READY`, `READY_WITH_CONTROLS`, `STRATEGICALLY_READY` ;
- sous-score économique ;
- AESS™ pondéré : TCO 25 %, unit economics 25 %, modèle de revenus 20 %, partage de valeur 15 %, adoption 15 % ;
- gates bloquants I1, I2 et I4 ;
- gate de preuve pour le statut stratégique ;
- cinq sous-scores : technique, réglementaire, opérationnel, économique et écosystème ;
- distinction explicite entre absence de réponse et non-conformité ;
- tests automatisés sans dépendance externe.

## Exécution

```bash
cd products/pispi-diag30
npm test
npm run check
```

## Exemple

```js
import { createAnswer, scoreDiagnostic } from './src/engine.js';
import { QUESTIONS } from './src/questions.js';

const answers = QUESTIONS.map(({ id }) => createAnswer(id, 'DOCUMENTE'));
const result = scoreDiagnostic(answers, { evidenceGatePassed: true });
console.log(result);
```

## Contrat de sécurité fonctionnelle

Le moteur ne déduit jamais une réponse manquante. Une question critique non renseignée bloque tout verdict positif. `STRATEGICALLY_READY` exige simultanément un score global d’au moins 90, un AESS™ d’au moins 90 et le passage du gate de preuves.

## Clause impérative

Le PI-SPI Readiness Checker™ est un outil indépendant de diagnostic et de préparation. Il ne constitue ni un agrément, ni une certification de la BCEAO, ni une confirmation de participation ou de connexion à PI-SPI.

## Suite d’implémentation

Le moteur est la couche de domaine. Les endpoints REST, la persistance de session, le rapport, le consentement, l’accessibilité, la journalisation et la preview doivent être branchés autour de ce noyau avant toute mise en production.
