from __future__ import annotations

import re
import unicodedata

from domain import LeadScore, QualificationSnapshot


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _extract_budget_xof(text: str) -> int | None:
    value = _normalize(text).replace("fcfa", "").replace("f cfa", "")
    million = re.search(r"\b(\d+(?:[.,]\d+)?)\s*(?:million|millions|mio)\b", value)
    if million:
        amount = float(million.group(1).replace(",", "."))
        return int(amount * 1_000_000)

    compact_m = re.search(r"\b(\d+(?:[.,]\d+)?)\s*m\b", value)
    if compact_m:
        amount = float(compact_m.group(1).replace(",", "."))
        return int(amount * 1_000_000)

    raw = re.search(r"(?:budget|jusqu.?a|max(?:imum)?)\D{0,12}(\d[\d .]{4,})", value)
    if raw:
        digits = re.sub(r"\D", "", raw.group(1))
        if digits:
            return int(digits)
    return None


def _extract_zone(text: str) -> str | None:
    value = text.strip()
    patterns = (
        r"(?:vers|a|à|sur|zone de|quartier de|quartier)\s+([A-Za-zÀ-ÿ'\- ]{2,40}?)(?=,|;|\.|\s+budget\b|\s+avec\b|\s+pour\b|$)",
        r"(?:à|a)\s+([A-Za-zÀ-ÿ'\- ]{2,40}?)(?=,|;|\.|$)",
    )
    for pattern in patterns:
        match = re.search(pattern, value, flags=re.IGNORECASE)
        if match:
            zone = re.sub(r"\s+", " ", match.group(1)).strip(" -")
            if zone:
                return zone
    return None


def _extract_timeline(text: str) -> str | None:
    value = _normalize(text)
    match = re.search(r"\bdans\s+(\d+)\s+(jour|jours|semaine|semaines|mois)\b", value)
    if match:
        return f"dans {match.group(1)} {match.group(2)}"
    for token in ("urgent", "immediatement", "cette semaine", "ce mois", "le mois prochain"):
        if token in value:
            return token
    return None


def qualify_text(text: str) -> QualificationSnapshot:
    value = _normalize(text)

    intent = None
    if any(token in value for token in ("acheter", "achat", "acquerir", "je cherche a acheter", "je cherche une parcelle", "buy")):
        intent = "buy"
    elif any(token in value for token in ("louer", "location", "locatif", "rent")):
        intent = "rent"

    property_type = None
    if any(token in value for token in ("parcelle", "terrain")):
        property_type = "land"
    elif any(token in value for token in ("maison", "villa")):
        property_type = "house"
    elif "appartement" in value:
        property_type = "apartment"
    elif any(token in value for token in ("bureau", "bureaux")):
        property_type = "office"
    elif any(token in value for token in ("boutique", "magasin", "local commercial")):
        property_type = "commercial"

    return QualificationSnapshot(
        intent=intent,
        property_type=property_type,
        zone=_extract_zone(text),
        budget_xof=_extract_budget_xof(text),
        timeline=_extract_timeline(text),
        consent_contact=True,
    )


def merge_qualification(
    previous: QualificationSnapshot | None,
    current: QualificationSnapshot,
) -> QualificationSnapshot:
    """Accumulate only fields that were explicitly learned across turns.

    Current explicit values win over previous values. Missing current fields reuse
    previously persisted evidence rather than inventing information.
    """
    if previous is None:
        return current
    return QualificationSnapshot(
        intent=current.intent or previous.intent,
        property_type=current.property_type or previous.property_type,
        zone=current.zone or previous.zone,
        budget_xof=current.budget_xof if current.budget_xof is not None else previous.budget_xof,
        timeline=current.timeline or previous.timeline,
        name=current.name or previous.name,
        consent_contact=current.consent_contact and previous.consent_contact,
    )


def score_qualification(snapshot: QualificationSnapshot) -> LeadScore:
    points = 0
    reasons: list[str] = []
    weights = (
        (snapshot.intent is not None, 20, "intent_explicit"),
        (snapshot.property_type is not None, 15, "property_type_explicit"),
        (snapshot.zone is not None, 20, "zone_explicit"),
        (snapshot.budget_xof is not None, 25, "budget_explicit"),
        (snapshot.timeline is not None, 20, "timeline_explicit"),
    )
    for present, weight, reason in weights:
        if present:
            points += weight
            reasons.append(reason)

    if points >= 70:
        temperature = "hot"
    elif points >= 40:
        temperature = "warm"
    else:
        temperature = "cold"
    return LeadScore(points=points, temperature=temperature, reasons=reasons)


def next_missing_question(snapshot: QualificationSnapshot) -> str | None:
    if snapshot.intent is None:
        return "Souhaitez-vous acheter ou louer ?"
    if snapshot.property_type is None:
        return "Quel type de bien recherchez-vous : parcelle, maison, appartement, bureau ou local commercial ?"
    if snapshot.zone is None:
        return "Dans quelle zone ou quel quartier recherchez-vous le bien ?"
    if snapshot.budget_xof is None:
        return "Quel budget approximatif avez-vous prévu ?"
    if snapshot.timeline is None:
        return "Dans quel délai souhaitez-vous avancer ?"
    return None
