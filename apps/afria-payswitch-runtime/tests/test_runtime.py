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
