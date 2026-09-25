import httpx

from notion_crm import (
    CANONICAL_CRM_DATA_SOURCE_ID,
    CeaCrmLead,
    NotionCrmAdapter,
    NotionCrmConfig,
    build_notion_crm_properties,
)


def sample_lead(consent: bool = True) -> CeaCrmLead:
    return CeaCrmLead(
        lead_id="cea-lead-001",
        name="Lead Test Diaspora",
        email="diaspora@example.com",
        whatsapp="+229 61 10 73 73",
        country="France",
        organization="Diaspora Network",
        content_id="VODUN-KAKPO-001",
        narrative_source="griot/capsule-01",
        primary_intent="Mémoire & Culture",
        next_best_offer="Accueil Cotonou 600 USD",
        language="FR",
        consent_contact=consent,
        revenue_attributed_usd=0,
        payment_status="Non proposé",
        priority="P1 - Cette semaine",
        note="source=Forum Diaspora Connect",
    )


def test_build_notion_crm_properties_matches_canonical_schema():
    props = build_notion_crm_properties(sample_lead())
    assert props["Nom"]["title"][0]["text"]["content"] == "Lead Test Diaspora"
    assert props["Content ID"]["rich_text"][0]["text"]["content"] == "VODUN-KAKPO-001"
    assert props["Primary Intent"]["select"]["name"] == "Mémoire & Culture"
    assert props["Next Best Offer"]["select"]["name"] == "Accueil Cotonou 600 USD"
    assert props["Consentement Contact"]["checkbox"] is True
    assert props["Revenue Attributed USD"]["number"] == 0
    assert props["Payment Status"]["select"]["name"] == "Non proposé"
    assert props["Priorité"]["select"]["name"] == "P1 - Cette semaine"
    assert props["Email"]["email"] == "diaspora@example.com"
    assert props["WhatsApp"]["phone_number"] == "+229 61 10 73 73"
    assert "CEA_LEAD_ID=cea-lead-001" in props["Notes"]["rich_text"][0]["text"]["content"]


def test_notion_adapter_refuses_pii_persistence_without_contact_consent():
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("Notion API must not be called without consent")

    adapter = NotionCrmAdapter(
        NotionCrmConfig(token="test-token"),
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    result = adapter.create_lead(sample_lead(consent=False))
    assert result["persisted"] is False
    assert result["reason"] == "contact_consent_required_for_crm_persistence"


def test_notion_adapter_posts_to_canonical_data_source_with_expected_headers():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        captured["json"] = __import__("json").loads(request.content.decode("utf-8"))
        return httpx.Response(
            200,
            json={
                "id": "notion-page-001",
                "url": "https://www.notion.so/notion-page-001",
            },
        )

    adapter = NotionCrmAdapter(
        NotionCrmConfig(token="test-token"),
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    result = adapter.create_lead(sample_lead())

    assert result["persisted"] is True
    assert result["data_source_id"] == CANONICAL_CRM_DATA_SOURCE_ID
    assert result["notion_page_id"] == "notion-page-001"
    assert captured["url"] == "https://api.notion.com/v1/pages"
    assert captured["headers"]["authorization"] == "Bearer test-token"
    assert captured["headers"]["notion-version"] == "2025-09-03"
    assert captured["json"]["parent"] == {
        "type": "data_source_id",
        "data_source_id": CANONICAL_CRM_DATA_SOURCE_ID,
    }
    assert captured["json"]["properties"]["Content ID"]["rich_text"][0]["text"]["content"] == "VODUN-KAKPO-001"
