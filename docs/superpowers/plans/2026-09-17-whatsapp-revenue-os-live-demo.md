# WhatsApp Revenue OS Live Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the previously proven BP-0001 behavior into the active repository and produce a governed WhatsApp real-estate lead vertical slice that is CI-proven and ready for live Meta/Supabase staging activation.

**Architecture:** A dedicated FastAPI app under `apps/whatsapp-revenue-os/` receives Meta webhooks, applies opt-out and policy gates before orchestration, persists CRM/evidence through a store abstraction, and sends replies through a WhatsApp adapter abstraction. Tests use in-memory store/fake adapter; staging uses Meta Cloud API and Supabase REST with secrets supplied only at deploy time.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, httpx, pytest, Meta WhatsApp Cloud API, Supabase/PostgREST, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-whatsapp-revenue-os-live-demo-design.md`

## Global Constraints

- Canonical asset: `PRD-WA-AGENT-FACTORY-001`.
- Pilot number: `+224 611 406 262`.
- No claim of production/client-live status before real staging evidence exists.
- STOP/opt-out blocks automated outbound immediately.
- Maximum three automated follow-ups in pilot mode.
- Legal, contractual, financial, price-guarantee and property-availability claims must escalate or be blocked.
- No secrets committed.
- Message-body logging is minimized; evidence logs use metadata/redaction by default.
- Audit/evidence records are append-only at the application contract level and have no CASCADE deletion in the migration.
- Every persisted row carries `organization_id`.
- Real outbound fails closed when Meta credentials or kill-switch policy disallow sending.
- TDD: tests precede or accompany each implementation increment and CI is the authoritative executable verifier in this remote workflow.

---

### Task 1: Core domain, policy and qualification engine

**Files:**
- Create: `apps/whatsapp-revenue-os/domain.py`
- Create: `apps/whatsapp-revenue-os/policy.py`
- Create: `apps/whatsapp-revenue-os/qualification.py`
- Create: `apps/whatsapp-revenue-os/test_policy.py`
- Create: `apps/whatsapp-revenue-os/test_qualification.py`

**Interfaces:**
- Consumes: normalized inbound text and conversation state.
- Produces: `InboundMessage`, `QualificationSnapshot`, `PolicyDecision`, `LeadScore`, `ConversationState`.

- [ ] **Step 1: Write failing policy tests**

```python
def test_stop_is_terminal_for_automation():
    decision = evaluate_inbound_policy("STOP", automated_followups_sent=0, kill_switch=False)
    assert decision.opt_out is True
    assert decision.allow_automated_reply is False


def test_fourth_followup_is_blocked():
    decision = evaluate_followup_policy(automated_followups_sent=3, kill_switch=False)
    assert decision.allow_automated_reply is False
```

- [ ] **Step 2: Write failing qualification tests**

```python
def test_extracts_explicit_real_estate_fields_without_inventing_missing_values():
    q = qualify_text("Je cherche une parcelle vers Calavi, budget 12 millions")
    assert q.intent == "buy"
    assert q.property_type == "land"
    assert q.zone == "Calavi"
    assert q.budget_xof == 12_000_000
    assert q.timeline is None
```

- [ ] **Step 3: Implement minimal typed domain and deterministic policy/qualification rules**

Implement explicit enums/dataclasses/Pydantic models, STOP synonyms, sensitive-topic detection, numeric budget parsing for common FCFA phrasing, and rule-based lead scoring. Do not call an LLM in this slice.

- [ ] **Step 4: Run unit tests**

Run: `pytest -q test_policy.py test_qualification.py`
Expected: PASS.

- [ ] **Step 5: Commit**

`feat(whatsapp-revenue-os): add governed qualification core`

---

### Task 2: CRM/evidence store abstraction and Supabase schema

**Files:**
- Create: `apps/whatsapp-revenue-os/store.py`
- Create: `apps/whatsapp-revenue-os/test_store.py`
- Create: `supabase/migrations/202609170001_whatsapp_revenue_os.sql`

**Interfaces:**
- Consumes: organization id, normalized contact/conversation/qualification/handoff/audit objects.
- Produces: a `RevenueStore` protocol, `InMemoryRevenueStore`, and `SupabaseRevenueStore` with methods `upsert_contact`, `get_or_create_conversation`, `save_qualification`, `save_handoff`, `save_opt_out`, `append_audit`, `summary`.

- [ ] **Step 1: Write failing store contract tests**

```python
def test_in_memory_store_tracks_qualification_handoff_and_optout():
    store = InMemoryRevenueStore()
    # seed contact/conversation, save qualification/handoff/optout
    summary = store.summary("org-demo")
    assert summary["qualified"] == 1
    assert summary["handoffs"] == 1
    assert summary["opt_outs"] == 1
```

- [ ] **Step 2: Implement in-memory store and Supabase REST adapter**

Supabase adapter uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` via `httpx`, sends `Prefer: resolution=merge-duplicates`, and raises on non-2xx responses. It never prints credentials.

- [ ] **Step 3: Add migration**

Create tables: `wa_contacts`, `wa_conversations`, `wa_messages_meta`, `wa_qualification_snapshots`, `wa_appointments`, `wa_handoffs`, `wa_opt_outs`, `wa_audit_events`. Include `organization_id`, timestamps, evidence ids where relevant, indexes, and no `ON DELETE CASCADE` on audit/evidence relations.

- [ ] **Step 4: Run store tests**

Run: `pytest -q test_store.py`
Expected: PASS.

- [ ] **Step 5: Commit**

`feat(whatsapp-revenue-os): add CRM evidence store`

---

### Task 3: Meta webhook and outbound adapter

**Files:**
- Create: `apps/whatsapp-revenue-os/whatsapp.py`
- Create: `apps/whatsapp-revenue-os/webhook.py`
- Create: `apps/whatsapp-revenue-os/test_webhook.py`
- Create: `apps/whatsapp-revenue-os/test_whatsapp.py`

**Interfaces:**
- Consumes: Meta webhook challenge/events and outbound text commands.
- Produces: verified normalized inbound events and `WhatsAppAdapter.send_text(to, text)`.

- [ ] **Step 1: Write failing verification/normalization tests**

Test webhook challenge token match/mismatch, HMAC SHA-256 signature verification, and normalization of a text message from the nested Meta event payload.

- [ ] **Step 2: Write fake/live adapter tests**

Test that fake adapter records sends, live adapter fails closed if credentials are missing, and kill-switch enforcement happens before adapter send.

- [ ] **Step 3: Implement Meta adapters**

Use `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_GRAPH_VERSION` (default `v23.0`). POST to `https://graph.facebook.com/{version}/{phone_number_id}/messages` with bearer token. Do not persist access tokens.

- [ ] **Step 4: Run tests**

Run: `pytest -q test_webhook.py test_whatsapp.py`
Expected: PASS.

- [ ] **Step 5: Commit**

`feat(whatsapp-revenue-os): add Meta webhook adapter`

---

### Task 4: Conversation orchestrator, human handoff and API

**Files:**
- Create: `apps/whatsapp-revenue-os/orchestrator.py`
- Create: `apps/whatsapp-revenue-os/main.py`
- Create: `apps/whatsapp-revenue-os/test_orchestrator.py`
- Create: `apps/whatsapp-revenue-os/test_main.py`

**Interfaces:**
- Consumes: `InboundMessage`, `RevenueStore`, `WhatsAppAdapter`.
- Produces: governed reply/handoff actions and API endpoints `/health`, `/webhook/whatsapp` GET/POST, `/demo/inbound`, `/dashboard`, `/dashboard/summary`, `/control/kill-switch`.

- [ ] **Step 1: Write failing end-to-end simulated test**

```python
def test_demo_flow_qualifies_persists_replies_and_handoffs():
    r = client.post("/demo/inbound", json={
        "from_number": "+224600000001",
        "text": "Bonjour, je cherche une parcelle vers Calavi, budget 12 millions"
    })
    assert r.status_code == 200
    body = r.json()
    assert body["qualification"]["zone"] == "Calavi"
    assert body["reply_sent"] is True
```

- [ ] **Step 2: Write STOP and kill-switch API tests**

STOP persists opt-out and sends no further automated reply. Kill switch blocks outbound while leaving dashboard/evidence readable.

- [ ] **Step 3: Implement orchestrator**

Flow: policy first → persist opt-out/audit if applicable → qualification → persist snapshot → score → decide missing-field question or handoff → guarded outbound → append audit. Human handoff becomes mandatory when lead score is hot or a sensitive topic is detected.

- [ ] **Step 4: Implement minimal operator dashboard**

Return a simple server-rendered HTML dashboard using FastAPI `HTMLResponse`, showing aggregate counts only: inbound leads, qualified, hot, appointments, handoffs, opt-outs, replies blocked/sent and kill-switch state. Avoid exposing full phone numbers/message bodies.

- [ ] **Step 5: Run application tests**

Run: `pytest -q test_orchestrator.py test_main.py`
Expected: PASS.

- [ ] **Step 6: Commit**

`feat(whatsapp-revenue-os): add governed lead orchestration API`

---

### Task 5: Packaging, CI, deployment contract and operator runbook

**Files:**
- Create: `apps/whatsapp-revenue-os/requirements.txt`
- Create: `apps/whatsapp-revenue-os/.env.example`
- Create: `apps/whatsapp-revenue-os/Dockerfile`
- Create: `apps/whatsapp-revenue-os/README.md`
- Create: `apps/whatsapp-revenue-os/render.yaml`
- Create: `.github/workflows/whatsapp-revenue-os.yml`

**Interfaces:**
- Produces a reproducible CI/deployment contract without storing credentials.

- [ ] **Step 1: Add pinned-minimum runtime dependencies**

`fastapi>=0.115.0`, `pydantic>=2.8.0`, `uvicorn>=0.30.0`, `pytest>=8.2.0`, `httpx>=0.27.0`.

- [ ] **Step 2: Add environment contract**

Document `ORGANIZATION_ID`, `STORE_MODE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `META_VERIFY_TOKEN`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_GRAPH_VERSION`, `OUTBOUND_KILL_SWITCH`.

- [ ] **Step 3: Add Docker/Render configuration**

Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Healthcheck: `/health`. Secret env vars are declared `sync: false` or documented, never committed.

- [ ] **Step 4: Add GitHub Actions workflow**

Trigger on PR and pushes to `feat/whatsapp-revenue-os-live-demo` affecting the app/migration/spec/plan/workflow. Install Python 3.12 deps; run `pytest -q`; run a secret-pattern grep; grep required governance anchors (`PRD-WA-AGENT-FACTORY-001`, `STOP`, `OUTBOUND_KILL_SWITCH`).

- [ ] **Step 5: Document activation runbook**

README explicitly separates `CI_PROVEN` from `DEMO_READY`. Live activation requires Supabase migration applied, Meta app/phone id/token/verify token/app secret configured, public HTTPS webhook registered, one real inbound/outbound, STOP test, kill-switch test and evidence capture.

- [ ] **Step 6: Commit**

`chore(whatsapp-revenue-os): add CI and staging contract`

---

### Task 6: Final verification and PR

**Files:**
- No new product files unless verification finds a defect.

**Interfaces:**
- Produces a reviewable PR and evidence-backed status boundary.

- [ ] **Step 1: Run full app test suite in CI**

Expected: all tests PASS on Python 3.12.

- [ ] **Step 2: Verify no secrets and no production overclaim**

Search repository changes for access tokens/service-role keys and for unsupported strings such as `DEMO_READY=true`, `production ready`, `client live`.

- [ ] **Step 3: Verify branch diff**

Ensure only the dedicated app, migration, workflow, spec/plan and intentional docs changed.

- [ ] **Step 4: Open PR**

Title: `feat: restore WhatsApp Revenue OS live demo vertical slice`

PR body must state: CI-proven if green; live Meta/Supabase activation remains a separate evidence gate.

- [ ] **Step 5: Do not merge until CI is green**

Merge decision remains separate from build completion.
