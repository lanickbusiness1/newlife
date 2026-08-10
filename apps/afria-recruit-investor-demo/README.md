# AfrIA Recruit™ — staging investisseur

Source canonique temporaire de la présentation investisseur rattachée à `PRD-RECRUIT-001`.

## Périmètre honnête

Cette application est un staging de concept, pas le produit AfrIA Recruit complet. Elle démontre :

1. une interface investisseur responsive ;
2. des KPI agrégés chargés par le RPC public `investor_demo_kpis` ;
3. un état indisponible sans chiffres de remplacement ;
4. les gates consentement, vérification et revue humaine ;
5. un assistant documentaire guidé, sans décision IA autonome.

Elle n’expose aucune donnée personnelle et ne remplace pas l’architecture produit Next.js/PWA/Railway prévue par le blueprint canonique.

## Variables publiques Vite

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Une clé publishable est publique par conception. Ne jamais utiliser de clé `service_role` ou de clé secrète dans cette application navigateur. Sans les deux variables, l’interface affiche uniquement des tirets.

Le fichier `.env.production` versionne exclusivement l’URL et la clé navigateur
publishable du staging. La sécurité ne repose pas sur leur confidentialité : l’accès
public reste limité au RPC agrégé versionné dans `supabase/migrations/`. La rotation
de cette clé peut être faite sans modifier le contrat du RPC.

## Commandes

```bash
npm ci
npm test
npx playwright install chromium
npm run build
npm run test:e2e
npm run scan:bundle
```

Les E2E servent le bundle de production déjà construit et interceptent son appel RPC
Supabase. Le même répertoire `dist/`, inchangé, est ensuite scanné et empaqueté.

`npm run check` exécute l’ensemble des contrôles dans l’ordre et laisse dans `dist/`
le build de production testé par les E2E. Le scanner refuse les marqueurs de secrets
serveur, les anciens chiffres non prouvés et toute source map publique.
