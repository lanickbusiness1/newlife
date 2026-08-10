# GDIZ Smart Service Node Web

Concept interne de landing pour GDIZ Smart Service Node. La page ne revendique
ni pilote actif, ni partenariat institutionnel, ni KPI validé.

## Contrats de publication

- les métriques restent à « À mesurer » tant qu'aucune preuve pilote n'existe ;
- le guide de parcours est statique et n'est pas présenté comme un agent IA ;
- vidéo et formulaire échouent fermés quand leurs variables sont absentes ;
- la page porte `noindex`, `nofollow` et `noarchive` ;
- les dépendances sont verrouillées et auditées avant chaque build.

## Vérification locale

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npm test
npm run typecheck
npm run deploybot:check
npm run build
```

## Déploiement

Le dépôt ne contient plus de workflow affirmant un déploiement Vercel : aucun projet
GDIZ n'existe encore dans l'équipe connectée, donc un hook ne pourrait prouver ni le
SHA construit ni l'état final d'une publication. Le workflow actuel vérifie seulement
le code. Un futur pipeline de production devra cibler un projet identifié, déployer
l'artefact testé par SHA et contrôler l'URL obtenue. Les intégrations publiques
optionnelles sont `NEXT_PUBLIC_FORM_WEBHOOK` et `NEXT_PUBLIC_DEMO_VIDEO_URL`.
