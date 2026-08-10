# AfrIA Recruit — runbook de release Pages

## Autorité et artefact

- Produit canonique : `PRD-RECRUIT-001`.
- Source du staging : `apps/afria-recruit-investor-demo`.
- Racine Pages : staging investisseur AfrIA Recruit.
- Chemin préservé : `/startup-accelerator/`.
- Manifeste public : `/release.json` avec SHA et date UTC du build.

Un seul workflow, `.github/workflows/afria-recruit-release.yml`, possède le droit de
produire puis déployer l’artefact Pages du dépôt. Aucun produit ne déploie vers Pages
dans un workflow concurrent.

## Chaîne de preuves

Le job `verify` exécute, dans cet ordre :

1. installation déterministe par `npm ci` avec Node.js 24 ;
2. audit npm au seuil `high` ;
3. tests unitaires et contrats du packager/scanner ;
4. E2E Playwright sur le vrai bundle Vite ;
5. build de production ;
6. scan du bundle et de l’artefact complet ;
7. paquet Pages unique et manifeste de release.

Le job `deploy` ne consomme que l’artefact produit par `verify`. Le job `smoke`
contrôle ensuite la racine Recruit, le SHA de `release.json` et le sous-chemin
Startup Accelerator.

## Activation et comportement sûr

GitHub Pages doit exister une fois au niveau du dépôt avec la source **GitHub
Actions**. Le workflow interroge l’API Pages : tant que le site renvoie `404`, la
vérification reste verte et le déploiement est volontairement ignoré, ce qui évite
les emails d’échec répétitifs. Après activation, tout prochain run `main` détecte le
site et déploie automatiquement. Un dispatch manuel avec `deploy=true` permet de
forcer un déploiement après activation.

## Données et secrets

`.env.production` ne contient que l’URL Supabase et une clé navigateur publishable.
Le navigateur n’a aucun accès direct aux tables métier : il appelle uniquement le
RPC agrégé versionné par
`supabase/migrations/20260810094242_secure_investor_demo_kpis.sql`. Le scanner
interdit les marqueurs `service_role`, clés serveur, anciens chiffres inventés et
source maps.

## Rollback

Chaque artefact est lié à un SHA Git. Le rollback opérationnel consiste à relancer
le workflow sur le dernier SHA dont les jobs `verify`, `deploy` et `smoke` sont
verts. Le smoke test doit confirmer que le SHA public correspond exactement au SHA
attendu. Une release sans smoke vert reste `NO-GO production`.
