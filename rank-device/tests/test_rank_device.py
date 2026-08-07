import os
from pathlib import Path

TEST_DB = Path(__file__).parent / 'test_rank_device.db'
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ['DATABASE_PATH'] = str(TEST_DB)
os.environ['PUBLIC_BASE_URL'] = 'http://testserver'
os.environ['ADMIN_PASSWORD'] = 'test-password'
os.environ['SECRET_KEY'] = 'test-secret'
os.environ['DEFAULT_WHATSAPP_NUMBER'] = '22997000000'

from fastapi.testclient import TestClient
from app.main import app, slugify


def test_slugify_accents():
    assert slugify('Amina Cosmétiques Bénin Téléphones') == 'amina-cosmetiques-benin-telephones'


def test_health_seed_public_and_qr():
    with TestClient(app) as client:
        assert client.get('/health').json()['status'] == 'ok'
        page = client.get('/m/reine-pagne-dantokpa')
        assert page.status_code == 200
        assert 'Reine Pagne Dantokpa' in page.text
        qr = client.get('/m/reine-pagne-dantokpa/qr.png')
        assert qr.status_code == 200
        assert qr.headers['content-type'] == 'image/png'
        assert qr.content.startswith(b'\x89PNG')


def test_admin_login_create_and_whatsapp_redirect():
    with TestClient(app) as client:
        assert client.get('/admin', follow_redirects=False).status_code == 303
        login = client.post('/admin/login', data={'password': 'test-password'}, follow_redirects=False)
        assert login.status_code == 303
        create = client.post('/admin/merchants', data={
            'business_name': 'Amina Cosmétiques Dantokpa',
            'category': 'Cosmétiques',
            'description': 'Pommades et parfums.',
            'country': 'Bénin',
            'city': 'Cotonou',
            'market_name': 'Dantokpa',
            'whatsapp_number': '22996000000',
            'products': 'Pommade | 2000 FCFA | Disponible\nParfum | Prix sur demande | Plusieurs modèles'
        }, follow_redirects=False)
        assert create.status_code == 303
        page = client.get('/m/amina-cosmetiques-dantokpa')
        assert page.status_code == 200
        assert 'Amina Cosmétiques Dantokpa' in page.text
        redirect = client.get('/m/amina-cosmetiques-dantokpa/contact', follow_redirects=False)
        assert redirect.status_code == 302
        assert redirect.headers['location'].startswith('https://wa.me/22996000000')


def test_api_and_exports():
    with TestClient(app) as client:
        data = client.get('/api/merchants').json()
        assert any(m['slug'] == 'reine-pagne-dantokpa' for m in data)
        assert client.get('/admin/export/merchants.csv', follow_redirects=False).status_code == 303
        client.post('/admin/login', data={'password': 'test-password'})
        export = client.get('/admin/export/merchants.csv')
        assert export.status_code == 200
        assert 'business_name' in export.text
