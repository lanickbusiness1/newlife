# AfrIAgenesis® Startup Accelerator Genome™

Application statique canonique de diagnostic d'éligibilité, d'evidence readiness et d'exécution des candidatures aux accélérateurs, concours d'innovation et programmes de scale-up.

## Fonctions livrées

- critères éliminatoires et niveaux de preuve ;
- gates de readiness et recommandations ;
- interface responsive sans dépendance externe ;
- profils programme alimentés par sources primaires ;
- contrôle humain obligatoire avant toute déclaration d'éligibilité ou soumission.

## Profil actif — Startup Qatar

Révision : `2026-09-15`.

Le cockpit Qatar est une extension du Genome existant, **pas un nouveau produit**. Les faits programme sont centralisés dans `PROGRAM_DATA` afin que toute évolution vérifiée soit patchée au même endroit avant tests et redéploiement.

Faits actuellement intégrés depuis Startup Qatar / Qatar Development Bank :

- START : jusqu'à 1,1 M USD — PoC/MVP + implantation au Qatar ;
- GROW : jusqu'à 5,5 M USD — entreprise établie + expansion au Qatar ;
- décaissements par tranches liés à des jalons ;
- `subsidized housing support` — aucune promesse de prise en charge intégrale du logement ;
- secteurs prioritaires dont AI & ML, B2B SaaS, FinTech, HealthTech, AgriTech, EduTech, Cybersecurity, IoT & Big Data, PropTech, Robotics & Drones.

Le compteur Qatar mesure uniquement la complétude interne de six preuves : personne morale/cap table, MVP exécutable, IP, preuve client/pilote, revenus/états financiers réels et plan de localisation Qatar. **Ce n'est pas un score QDB.**

Sources primaires :

- https://startupqatar.qa/en/investment-program
- https://www.qdb.qa/financing-and-funding/equity-and-investment/startup-qatar-investment-program

## Exécution

Ouvrir `index.html` dans un navigateur ou servir ce dossier avec n'importe quel serveur statique.

## Gouvernance

Identifiant canonique : `GENOME-STARTUP-ACCELERATOR-001`.
Toute soumission demeure soumise à validation humaine et aux contrôles M6, S7+ et M8. Les changements de données externes doivent déclencher : source primaire → patch `PROGRAM_DATA` → tests → revue → déploiement → vérification post-déploiement.
