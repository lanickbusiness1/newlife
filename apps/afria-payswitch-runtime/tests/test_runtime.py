import os
from datetime import date

os.environ['PAYSWITCH_API_KEY'] = 'test-key'

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
AUTH = {'X-API-Key': 'test-key'}


def test_health_reports_runtime_identity_without_auth():
    r = client.get('/health')
    assert r.status_code == 200
    body = r.json()
    assert body['status'] == 'ok'
    assert body['service'] == 'afria-payswitch-merchant-to-credit-runtime'
    assert body['regulatory_boundary'] == 'NON_LENDER_NON_CUSTODIAL'


def test_sensitive_endpoints_are_deny_by_default():
    r = client.post('/v1/merchants', json={
        'legal_name': 'Unauthorized Shop',
        'country': 'ML',
        'currency': 'XOF',
        'kyb_status': 'VERIFIED'
    })
    assert r.status_code == 401


def test_merchant_to_credit_readiness_flow_is_deterministic_and_non_lending():
    merchant = client.post('/v1/merchants', headers=AUTH, json={
        'legal_name': 'Demo Market SARL',
        'country': 'ML',
        'currency': 'XOF',
        'kyb_status': 'VERIFIED'
    })
    assert merchant.status_code == 201
    merchant_id = merchant.json()['id']

    txs = []
    for i in range(12):
        txs.append({
            'external_id': f'in-{merchant_id}-{i}',
            'occurred_on': str(date(2026, 8, i + 1)),
            'amount': 150000 + (i * 5000),
            'direction': 'INFLOW',
            'channel': 'MOBILE_MONEY',
            'counterparty_hash': f'buyer-{i % 4}'
        })
        txs.append({
            'external_id': f'out-{merchant_id}-{i}',
            'occurred_on': str(date(2026, 8, i + 1)),
            'amount': 65000 + (i * 2000),
            'direction': 'OUTFLOW',
            'channel': 'BANK',
            'counterparty_hash': f'supplier-{i % 3}'
        })

    imported = client.post(
        f'/v1/merchants/{merchant_id}/transactions:import', headers=AUTH, json={'transactions': txs}
    )
    assert imported.status_code == 202
    assert imported.json()['accepted'] == 24

    repeated = client.post(
        f'/v1/merchants/{merchant_id}/transactions:import', headers=AUTH, json={'transactions': txs}
    )
    assert repeated.status_code == 202
    assert repeated.json()['accepted'] == 0
    assert repeated.json()['duplicates'] == 24

    evaluation = client.post(
        f'/v1/merchants/{merchant_id}/credit-readiness:evaluate', headers=AUTH
    )
    assert evaluation.status_code == 200
    result = evaluation.json()
    assert 0 <= result['score'] <= 100
    assert result['band'] in {'READY', 'REVIEW', 'HIGH_RISK'}
    assert result['is_credit_decision'] is False
    assert result['decision_owner'] == 'REGULATED_PARTNER'
    assert 'monthly_net_cashflow' in result['metrics']

    passport = client.get(f'/v1/merchants/{merchant_id}/financial-passport', headers=AUTH)
    assert passport.status_code == 200
    p = passport.json()
    assert p['merchant_id'] == merchant_id
    assert p['kyb_status'] == 'VERIFIED'
    assert p['credit_readiness']['score'] == result['score']


def test_partner_decision_is_recorded_but_not_generated_by_afriagenesis():
    merchant = client.post('/v1/merchants', headers=AUTH, json={
        'legal_name': 'Sahel Shop',
        'country': 'SN',
        'currency': 'XOF',
        'kyb_status': 'VERIFIED'
    }).json()

    decision = client.post('/v1/partner-decisions', headers=AUTH, json={
        'merchant_id': merchant['id'],
        'partner_name': 'Sandbox Regulated Bank',
        'partner_reference': 'BANK-REF-001',
        'decision': 'REVIEW',
        'reason_code': 'INSUFFICIENT_HISTORY'
    })
    assert decision.status_code == 201
    body = decision.json()
    assert body['decision_source'] == 'EXTERNAL_REGULATED_PARTNER'

    evidence = client.get(f"/v1/merchants/{merchant['id']}/evidence", headers=AUTH)
    assert evidence.status_code == 200
    event_types = [event['event_type'] for event in evidence.json()['events']]
    assert 'MERCHANT_CREATED' in event_types
    assert 'PARTNER_DECISION_RECORDED' in event_types


def test_console_is_protected_and_renders_operator_dashboard(monkeypatch):
    import base64
    monkeypatch.setenv('PAYSWITCH_CONSOLE_USER', 'operator')
    monkeypatch.setenv('PAYSWITCH_CONSOLE_PASSWORD', 'strong-pass')

    unauthorized = client.get('/console')
    assert unauthorized.status_code == 401

    token = base64.b64encode(b'operator:strong-pass').decode()
    authorized = client.get('/console', headers={'Authorization': f'Basic {token}'})
    assert authorized.status_code == 200
    assert 'AfrIA PaySwitch' in authorized.text
    assert 'Merchant-to-Credit Pilot Console' in authorized.text
    assert 'Create merchant' in authorized.text


def test_console_can_create_merchant_and_import_csv(monkeypatch):
    import base64
    monkeypatch.setenv('PAYSWITCH_CONSOLE_USER', 'operator')
    monkeypatch.setenv('PAYSWITCH_CONSOLE_PASSWORD', 'strong-pass')
    token = base64.b64encode(b'operator:strong-pass').decode()
    headers = {'Authorization': f'Basic {token}'}

    create = client.post('/console/merchants', headers=headers, data={
        'legal_name': 'Console Market SARL',
        'country': 'ML',
        'currency': 'XOF',
        'kyb_status': 'VERIFIED',
    }, follow_redirects=False)
    assert create.status_code == 303

    page = client.get('/console', headers=headers)
    assert page.status_code == 200
    assert 'Console Market SARL' in page.text

    marker = 'Console Market SARL'
    html = page.text
    merchant_id = html.split(f'data-merchant-name="{marker}" data-merchant-id="', 1)[1].split('"', 1)[0]

    csv_body = (
        'external_id,occurred_on,amount,direction,channel,counterparty_hash\n'
        'console-in-1,2026-09-01,250000,INFLOW,MOBILE_MONEY,buyer-a\n'
        'console-out-1,2026-09-02,100000,OUTFLOW,BANK,supplier-a\n'
    )
    upload = client.post(
        f'/console/merchants/{merchant_id}/transactions:import-csv',
        headers=headers,
        files={'file': ('transactions.csv', csv_body, 'text/csv')},
        follow_redirects=False,
    )
    assert upload.status_code == 303

    evaluate = client.post(
        f'/console/merchants/{merchant_id}/evaluate', headers=headers, follow_redirects=False
    )
    assert evaluate.status_code == 303

    passport = client.get(f'/v1/merchants/{merchant_id}/financial-passport', headers=AUTH)
    assert passport.status_code == 200
    assert passport.json()['credit_readiness']['metrics']['transaction_count'] == 2
