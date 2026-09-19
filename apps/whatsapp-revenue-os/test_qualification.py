from qualification import next_missing_question, qualify_text, score_qualification


def test_extracts_explicit_real_estate_fields_without_inventing_missing_values():
    q = qualify_text("Je cherche une parcelle vers Calavi, budget 12 millions")
    assert q.intent == "buy"
    assert q.property_type == "land"
    assert q.zone == "Calavi"
    assert q.budget_xof == 12_000_000
    assert q.timeline is None


def test_scores_hot_when_core_fields_and_timeline_are_explicit():
    q = qualify_text("Je veux acheter une maison à Cotonou, budget 25 millions, urgent")
    score = score_qualification(q)
    assert score.points == 100
    assert score.temperature == "hot"


def test_missing_field_question_is_deterministic():
    q = qualify_text("Je cherche une parcelle")
    assert next_missing_question(q) == "Dans quelle zone ou quel quartier recherchez-vous le bien ?"


def test_rent_intent_and_apartment_are_detected():
    q = qualify_text("Je veux louer un appartement à Fidjrossè, budget 450000")
    assert q.intent == "rent"
    assert q.property_type == "apartment"
    assert q.zone == "Fidjrossè"
    assert q.budget_xof == 450000
