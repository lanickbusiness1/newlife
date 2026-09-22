# Rank Device — WhatsApp-first visibility kit

Rank Device est une application web légère pour petits marchands africains : fiche publique, mini catalogue, QR code, bouton WhatsApp, tracking non invasif et dashboard admin.

## Fonctionnalités

- Fiche publique marchand : `/m/{slug}`
- Annuaire public : `/directory`
- QR code PNG : `/m/{slug}/qr.png`
- Affiche imprimable : `/m/{slug}/poster`
- WhatsApp avec message prérempli
- Tracking : vues, clics WhatsApp, partages et QR
- Admin protégé par mot de passe : `/admin/login`
- Création, édition, pause et archivage des marchands
- Export CSV marchands et événements
- `robots.txt`, `sitemap.xml`, API publique

## Lancement local

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Ouvrir :

- http://localhost:8000
- http://localhost:8000/admin/login
- http://localhost:8000/m/reine-pagne-dantokpa

## Variables de production

```bash
ADMIN_PASSWORD=mot-de-passe-fort
SECRET_KEY=secret-long-unique
PUBLIC_BASE_URL=https://votre-url.onrender.com
DATABASE_PATH=./data/rank_device.db
DEFAULT_WHATSAPP_NUMBER=229xxxxxxxx
```

## Tests

```bash
pytest -q
python -m compileall app scripts
```

## Déploiement Render

Render doit utiliser le dossier racine `rank-device` ou lire `render.yaml`.

Build command :

```bash
pip install -r requirements.txt
```

Start command :

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Doctrine terrain

Le KPI prioritaire est le nombre de clics WhatsApp par marchand sur 7 jours. Ne pas promettre de ventes garanties. Ne pas créer de faux avis ou faux profils Google Business. Rank Device est une fiche de visibilité et de contact, pas une fausse boutique.

Powered by afrIAgenesis®.
