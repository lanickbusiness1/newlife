# APDP BJ — Système interne d’analyse et d’instruction des demandes

Statut : fondation exécutable V0.1

## Périmètre
APDP BJ est distinct de PIA Genesis™. Il couvre la réception, le contrôle, la recevabilité, l’affectation, l’instruction, l’analyse, les demandes de complément, la validation, la décision humaine, la notification, l’archivage et l’audit.

## Vertical slice V0.1
Dépôt fictif → contrôle de complétude → accusé de réception → recevabilité → affectation → analyse → demande de complément → réponse → réanalyse → avis → validation hiérarchique → décision humaine → notification → dossier final → journal d’audit.

## Architecture initiale
- apps/web : portail demandeur et cockpits APDP
- apps/api : API métier
- packages/domain : états, rôles et règles
- packages/db : migrations PostgreSQL
- packages/evidence : journal de preuves
- tests : tests unitaires, intégration et E2E

## Règles constitutionnelles
- aucune décision réglementaire finale par IA ;
- RBAC et ABAC obligatoires ;
- chaque action et appel IA est auditable ;
- aucun statut « construit » sans build, migrations et flux E2E prouvés.
