# AfrIA Recruit™ Candidate OS™

Application opérationnelle canonique de `PRD-RECRUIT-001`.

## Statut

Ce répertoire est en construction gouvernée. Il ne constitue pas encore une publication production ni une validation M8/Big4.

## Frontières

- `apps/afria-recruit/` : parcours candidat opérationnel authentifié.
- `apps/afria-recruit-investor-demo/` : démonstration publique séparée et sans données personnelles.
- `apps/web/` : GDIZ Smart Service Node, hors périmètre Recruit.
- `supabase/` : couche de données canonique partagée.

## Sécurité

Les clés privilégiées sont exclusivement serveur. Le navigateur ne reçoit qu’une URL publique et une clé publiable. Toute écriture privilégiée doit authentifier l’utilisateur et prouver l’appartenance du profil candidat avant usage du client serveur privilégié.

## Variables d’environnement

Copier `.env.example` vers un fichier local non versionné et renseigner uniquement les valeurs nécessaires. Aucun secret réel ne doit être commité.

## Vérification

```bash
npm install --ignore-scripts
npm run test:unit
npm run typecheck
npm run build
npm run scan:build
```

Le workflow sera basculé sur `npm ci` dès que le lockfile généré par le runner aura été figé dans la branche.
