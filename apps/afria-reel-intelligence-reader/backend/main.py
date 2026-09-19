from __future__ import annotations

from hashlib import sha256
from typing import Literal
from urllib.parse import urlparse
import json
import re

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from resolver import XSourceError, resolve_x_media

APP_ID = "MOD-REEL-INTEL-001"
APP_VERSION = "0.2.0-test-health-001"

app = FastAPI(
    title="AfrIAgenesis Reel Intelligence Reader",
    version=APP_VERSION,
    description=(
        "Evidence-first social media reader boundary. This slice proves source provenance, "
        "anti-hallucination claim extraction, resilient X media resolution, evidence-state "
        "routing, and audit lineage."
    ),
)


class SourceResolveRequest(BaseModel):
    source_url: HttpUrl
    observed_caption: str | None = None
    source_author: str | None = None
    media_type: Literal["video", "audio", "image", "text", "unknown"] = "unknown"
    fetch_http_status: int | None = Field(default=None, ge=100, le=599)


class MediaResolveRequest(BaseModel):
    source_url: HttpUrl


class SourceEvidence(BaseModel):
    evidence_id: str
    canonical_asset_id: str = APP_ID
    source_platform: str
    source_url: str
    observed_caption: str | None
    source_author: str | None
    media_type: str
    media_access: str
    claim_state: Literal["CLAIMS_NOT_EXTRACTED", "CLAIMS_EXTRACTED"]
    evidence_state: str
    semantic_state: Literal["UNRESOLVED"] = "UNRESOLVED"
    health_gate: str
    inference_from_caption_allowed: Literal[False] = False


class ClaimExtractRequest(BaseModel):
    evidence_id: str
    transcript: str | None = None
    ocr_text: str | None = None


class ClaimExtractResponse(BaseModel):
    evidence_id: str
    claim_state: Literal["CLAIMS_NOT_EXTRACTED", "CLAIMS_EXTRACTED"]
    claims: list[str]
    extraction_basis: list[Literal["transcript", "ocr_text"]]
    caption_used_as_claim: Literal[False] = False


class EvidenceVerifyRequest(BaseModel):
    claim_count: int = Field(ge=0)
    sources_attached: int = Field(default=0, ge=0)
    contradictions_attached: int = Field(default=0, ge=0)


class EvidenceVerifyResponse(BaseModel):
    evidence_state: Literal[
        "NO_CLAIMS",
        "VERIFICATION_REQUIRED",
        "EVIDENCE_ATTACHED",
        "CONTESTED",
    ]
    informational_context_allowed: bool
    requires_human_review: bool


class ContextEligibilityRequest(BaseModel):
    claim_state: Literal["CLAIMS_NOT_EXTRACTED", "CLAIMS_EXTRACTED"]
    evidence_state: Literal[
        "NO_CLAIMS",
        "VERIFICATION_REQUIRED",
        "EVIDENCE_ATTACHED",
        "CONTESTED",
    ]


class ContextEligibilityResponse(BaseModel):
    route_to_afria_nutri: bool
    mode: Literal["BLOCK", "INFORMATIONAL_ONLY"]
    reason: str


class LedgerRequest(BaseModel):
    source_url: HttpUrl
    claim_state: str
    evidence_state: str
    media_access: str
    source_ids: list[str] = []


class LedgerResponse(BaseModel):
    ledger_id: str
    canonical_asset_id: str = APP_ID
    audit_hash: str
    rollback_key: str


def _platform(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if host in {"x.com", "www.x.com", "twitter.com", "www.twitter.com"}:
        return "X"
    if "tiktok.com" in host:
        return "TikTok"
    if "instagram.com" in host:
        return "Instagram"
    if "youtube.com" in host or "youtu.be" in host:
        return "YouTube"
    if "facebook.com" in host:
        return "Facebook"
    return host or "unknown"


def _stable_id(prefix: str, payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"{prefix}{sha256(encoded).hexdigest()[:16].upper()}"


def _media_access(status: int | None) -> str:
    if status is None:
        return "unknown"
    if status == 403:
        return "restricted_403"
    if status == 404:
        return "not_found_404"
    if 200 <= status < 300:
        return "accessible"
    if 500 <= status < 600:
        return "upstream_error"
    return f"http_{status}"


def _extract_sentences(text: str) -> list[str]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return []
    parts = re.split(r"(?<=[.!?])\s+|\n+", cleaned)
    return [p.strip() for p in parts if p.strip()]


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "afria-reel-intelligence-reader",
        "canonical_asset_id": APP_ID,
        "version": APP_VERSION,
        "readiness": "TEST_PROVEN_SLICE",
        "commercial_boundary": "not_production_health_advice",
        "network_resolver": "x_whitelist_fallback_chain",
    }


@app.post("/reel/resolve-source", response_model=SourceEvidence)
def resolve_source(payload: SourceResolveRequest) -> SourceEvidence:
    source_url = str(payload.source_url)
    raw = {
        "source_url": source_url,
        "observed_caption": payload.observed_caption,
        "source_author": payload.source_author,
        "media_type": payload.media_type,
    }
    media_access = _media_access(payload.fetch_http_status)
    return SourceEvidence(
        evidence_id=_stable_id("RIR-SRC-", raw),
        source_platform=_platform(source_url),
        source_url=source_url,
        observed_caption=payload.observed_caption,
        source_author=payload.source_author,
        media_type=payload.media_type,
        media_access=media_access,
        claim_state="CLAIMS_NOT_EXTRACTED",
        evidence_state="SOURCE_METADATA_VERIFIED",
        health_gate="CLOSED_UNTIL_CLAIMS_EXTRACTED",
    )


@app.post("/reel/media/resolve")
async def media_resolve(payload: MediaResolveRequest) -> dict:
    try:
        return await resolve_x_media(str(payload.source_url))
    except XSourceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/reel/claims/extract", response_model=ClaimExtractResponse)
def extract_claims(payload: ClaimExtractRequest) -> ClaimExtractResponse:
    claims: list[str] = []
    basis: list[Literal["transcript", "ocr_text"]] = []

    if payload.transcript and payload.transcript.strip():
        claims.extend(_extract_sentences(payload.transcript))
        basis.append("transcript")
    if payload.ocr_text and payload.ocr_text.strip():
        claims.extend(_extract_sentences(payload.ocr_text))
        basis.append("ocr_text")

    deduped = list(dict.fromkeys(claims))
    state: Literal["CLAIMS_NOT_EXTRACTED", "CLAIMS_EXTRACTED"] = (
        "CLAIMS_EXTRACTED" if deduped else "CLAIMS_NOT_EXTRACTED"
    )
    return ClaimExtractResponse(
        evidence_id=payload.evidence_id,
        claim_state=state,
        claims=deduped,
        extraction_basis=basis,
    )


@app.post("/evidence/verify-state", response_model=EvidenceVerifyResponse)
def verify_state(payload: EvidenceVerifyRequest) -> EvidenceVerifyResponse:
    if payload.claim_count == 0:
        return EvidenceVerifyResponse(
            evidence_state="NO_CLAIMS",
            informational_context_allowed=False,
            requires_human_review=False,
        )
    if payload.contradictions_attached > 0:
        return EvidenceVerifyResponse(
            evidence_state="CONTESTED",
            informational_context_allowed=True,
            requires_human_review=True,
        )
    if payload.sources_attached > 0:
        return EvidenceVerifyResponse(
            evidence_state="EVIDENCE_ATTACHED",
            informational_context_allowed=True,
            requires_human_review=True,
        )
    return EvidenceVerifyResponse(
        evidence_state="VERIFICATION_REQUIRED",
        informational_context_allowed=False,
        requires_human_review=True,
    )


@app.post("/nutri/context/eligibility", response_model=ContextEligibilityResponse)
def context_eligibility(payload: ContextEligibilityRequest) -> ContextEligibilityResponse:
    if payload.claim_state != "CLAIMS_EXTRACTED":
        return ContextEligibilityResponse(
            route_to_afria_nutri=False,
            mode="BLOCK",
            reason="claims_not_extracted",
        )
    if payload.evidence_state not in {"EVIDENCE_ATTACHED", "CONTESTED"}:
        return ContextEligibilityResponse(
            route_to_afria_nutri=False,
            mode="BLOCK",
            reason="evidence_not_attached",
        )
    return ContextEligibilityResponse(
        route_to_afria_nutri=True,
        mode="INFORMATIONAL_ONLY",
        reason="evidence_context_available_human_review_required",
    )


@app.post("/evidence/ledger", response_model=LedgerResponse)
def evidence_ledger(payload: LedgerRequest) -> LedgerResponse:
    normalized = payload.model_dump(mode="json")
    digest = sha256(
        json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    ledger_id = f"RIR-EVID-{digest[:16].upper()}"
    return LedgerResponse(
        ledger_id=ledger_id,
        audit_hash=digest,
        rollback_key=f"rollback:{ledger_id}",
    )
