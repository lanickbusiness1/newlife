# APDP BJ — Système interne d’analyse et d’instruction des demandes

Statut : Release Candidate technique V0.4 en construction active.

## Périmètre

APDP BJ est distinct de PIA Genesis™. Il couvre la réception, le contrôle, la recevabilité, l’affectation, l’instruction, l’analyse, les demandes de complément, la validation, la décision humaine, la notification, l’archivage et l’audit.

## Vertical slice actuellement prouvé

Création d’un dossier → modification du brouillon → enregistrement documentaire avec empreinte SHA-256 → dépôt → réception → contrôle de complétude → recevabilité → affectation → instruction → analyse → validation hiérarchique → préparation de décision → validation humaine → décision → statistiques → journal d’audit.

Ce parcours est exécuté automatiquement dans GitHub Actions sur une base PostgreSQL réelle.

## Architecture

- `apps/web` : cockpit React/Vite connecté à l’API ;
- `apps/api` : API Fastify, authentification JWT, RBAC et ABAC ;
- `packages/domain` : machine d’état, entités et règles constitutionnelles ;
- `packages/db` : migrations PostgreSQL et Evidence Ledger ;
- `scripts` : seed CI et scénario E2E ;
- Docker : image unique servant l’API et le cockpit.

## Endpoints principaux

### Identité

- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`

### Dossiers et workflow

- `POST /v1/dossiers`
- `GET /v1/dossiers`
- `GET /v1/dossiers/:id`
- `PATCH /v1/dossiers/:id`
- `POST /v1/dossiers/:id/transitions`
- `GET /v1/dossiers/:id/events`

### Documents, affectations et décisions

- `POST /v1/dossiers/:id/documents`
- `GET /v1/dossiers/:id/documents`
- `POST /v1/dossiers/:id/assignments`
- `GET /v1/dossiers/:id/assignments`
- `POST /v1/dossiers/:id/decisions`
- `POST /v1/dossiers/:id/decisions/:decisionId/validate`
- `GET /v1/dossiers/:id/decisions`

### Pilotage et preuves

- `GET /v1/statistics`
- `GET /v1/audit`
- `GET /v1/dossiers/:id/audit`
- `GET /health`

## Exécution locale

```bash
npm install
npm run typecheck
npm run test
npm run build
docker compose up --build
```

Le cockpit est ensuite servi par l’API sur le port `3001`.

## Production Assurance

Le pipeline vérifie :

1. installation ;
2. tests unitaires ;
3. typecheck API et cockpit ;
4. build API et cockpit ;
5. démarrage PostgreSQL ;
6. application réelle des migrations ;
7. contrôle des rôles et permissions ;
8. démarrage de l’API ;
9. livraison effective du cockpit ;
10. vertical slice E2E ;
11. construction de l’image Docker.

## Règles constitutionnelles

- aucune décision réglementaire finale par IA ;
- RBAC et ABAC obligatoires ;
- chaque action et appel IA doit être auditable ;
- toute pièce est associée à une empreinte cryptographique ;
- aucun statut « déployé » sans URL, monitoring, sauvegarde, restauration et rollback prouvés.
