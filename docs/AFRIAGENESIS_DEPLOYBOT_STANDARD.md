# AfrIAgenesis DeployBot — Standard opératoire

## Mission
Fermer la boucle finale entre produit fini, repo propre et déploiement réel.

## Entrées minimales
- project_name
- github_repo
- root_directory
- target_platform
- env_vars_required
- deployment_status

## Sortie obligatoire
- statut: NON_PRET / PRET_AU_BUILD / PRET_AU_DEPLOIEMENT / DEPLOYE
- blocage_principal
- action_unique_suivante
- risques
- feu_final

## Checklist native
- Repo trouvé
- Root directory identifié
- package.json présent
- page principale présente
- layout présent
- globals.css présent
- variables d’environnement listées
- plateforme de déploiement identifiée
- domaine requis ou non
- état final sans ambiguïté

## Réponse standard
### Statut

### Confirmé

### Manquant

### Blocage principal

### Action unique suivante

### Risques

### Feu final

## Cas GDIZ Smart Service Node
- project_name: GDIZ Smart Service Node
- github_repo: lanickbusiness1/newlife
- root_directory: apps/web
- target_platform: Vercel
- env_vars_required:
  - NEXT_PUBLIC_FORM_WEBHOOK
  - NEXT_PUBLIC_DEMO_VIDEO_URL
- statut actuel: PRET_AU_DEPLOIEMENT
- blocage principal: projet Vercel non encore pointé sur apps/web
- action unique suivante: créer le projet Vercel depuis le repo et choisir apps/web comme Root Directory
- feu final: OUI
