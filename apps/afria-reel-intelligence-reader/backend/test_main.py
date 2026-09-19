from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_exposes_canonical_boundary():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["canonical_asset_id"] == "MOD-REEL-INTEL-001"
    assert body["readiness"] == "TEST_PROVEN_SLICE"


def test_x_403_is_resilience_state_not_terminal_error():
    r = client.post(
        "/reel/resolve-source",
        json={
            "source_url": "https://x.com/Blessinghls/status/2101019521947451594",
            "observed_caption": "Organ foods 💝",
            "source_author": "ThinkBeyond / @Blessinghls",
            "media_type": "video",
            "fetch_http_status": 403,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["source_platform"] == "X"
    assert body["media_access"] == "restricted_403"
    assert body["claim_state"] == "CLAIMS_NOT_EXTRACTED"
    assert body["inference_from_caption_allowed"] is False
    assert body["semantic_state"] == "UNRESOLVED"


def test_caption_is_never_promoted_to_claim():
    source = client.post(
        "/reel/resolve-source",
        json={
            "source_url": "https://x.com/example/status/1",
            "observed_caption": "A viral health caption",
            "media_type": "video",
            "fetch_http_status": 403,
        },
    ).json()
    r = client.post(
        "/reel/claims/extract",
        json={"evidence_id": source["evidence_id"]},
    )
    body = r.json()
    assert body["claim_state"] == "CLAIMS_NOT_EXTRACTED"
    assert body["claims"] == []
    assert body["caption_used_as_claim"] is False


def test_claims_come_only_from_supplied_transcript_or_ocr():
    r = client.post(
        "/reel/claims/extract",
        json={
            "evidence_id": "RIR-SRC-TEST",
            "transcript": "Claim one. Claim two?",
            "ocr_text": "Claim three! Claim one.",
        },
    )
    body = r.json()
    assert body["claim_state"] == "CLAIMS_EXTRACTED"
    assert body["claims"] == ["Claim one.", "Claim two?", "Claim three!"]
    assert body["extraction_basis"] == ["transcript", "ocr_text"]


def test_verification_required_without_sources():
    r = client.post(
        "/evidence/verify-state",
        json={"claim_count": 2, "sources_attached": 0, "contradictions_attached": 0},
    )
    body = r.json()
    assert body["evidence_state"] == "VERIFICATION_REQUIRED"
    assert body["informational_context_allowed"] is False


def test_contradiction_is_preserved_as_contested():
    r = client.post(
        "/evidence/verify-state",
        json={"claim_count": 1, "sources_attached": 2, "contradictions_attached": 1},
    )
    body = r.json()
    assert body["evidence_state"] == "CONTESTED"
    assert body["informational_context_allowed"] is True
    assert body["requires_human_review"] is True


def test_afria_nutri_route_blocks_unverified_claims():
    r = client.post(
        "/nutri/context/eligibility",
        json={"claim_state": "CLAIMS_EXTRACTED", "evidence_state": "VERIFICATION_REQUIRED"},
    )
    body = r.json()
    assert body["route_to_afria_nutri"] is False
    assert body["mode"] == "BLOCK"


def test_afria_nutri_route_is_informational_only_after_evidence():
    r = client.post(
        "/nutri/context/eligibility",
        json={"claim_state": "CLAIMS_EXTRACTED", "evidence_state": "EVIDENCE_ATTACHED"},
    )
    body = r.json()
    assert body["route_to_afria_nutri"] is True
    assert body["mode"] == "INFORMATIONAL_ONLY"


def test_ledger_is_deterministic_and_has_rollback_key():
    payload = {
        "source_url": "https://x.com/Blessinghls/status/2101019521947451594",
        "claim_state": "CLAIMS_NOT_EXTRACTED",
        "evidence_state": "SOURCE_METADATA_VERIFIED",
        "media_access": "restricted_403",
        "source_ids": ["turn969038search0"],
    }
    a = client.post("/evidence/ledger", json=payload).json()
    b = client.post("/evidence/ledger", json=payload).json()
    assert a == b
    assert a["ledger_id"].startswith("RIR-EVID-")
    assert a["rollback_key"] == f"rollback:{a['ledger_id']}"
