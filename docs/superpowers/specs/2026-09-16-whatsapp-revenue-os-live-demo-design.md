# WhatsApp Revenue OS — Live Demo Vertical Slice Design

**Date:** 2026-09-16
**Asset:** AfrIAgenesis® WhatsApp Agent Factory & Revenue OS™ (`PRD-WA-AGENT-FACTORY-001`)
**Pilot number:** +224 611 406 262
**Status:** Design approved in principle by CEO; implementation gated on this written spec review.

## 1. Objective
Recover the previously proven BP-0001 behavior and produce a real, demoable vertical slice connected to the pilot WhatsApp number, without claiming production readiness before live evidence exists.

The demo must prove one complete path:

`WhatsApp inbound → consent/opt-out guard → qualification → CRM persistence → lead score → appointment proposal → human handoff → controlled follow-up → dashboard/audit`

## 2. Why this is a recovery, not a new product
Notion evidence shows BP-0001 was previously validated in sandbox with 274/274 tests green and S7+ scan OK, but the canonical GitHub repository currently contains no BP-0001/WhatsApp Agent Factory implementation on `main`. This work restores the existing canonical asset into the active repository and replaces simulated adapters one by one with real staging adapters.

## 3. Architecture decision
Create a dedicated app at `apps/whatsapp-revenue-os/` and reuse repository conventions already present under `apps/*`.

### Components
1. **Webhook API**
   - Receives WhatsApp Business Platform events.
   - Verifies webhook challenge/signature.
   - Normalizes inbound messages into an internal event contract.

2. **Conversation Orchestrator**
   - State machine for: NEW → QUALIFYING → QUALIFIED → APPOINTMENT_PROPOSED → HANDOFF → CLOSED.
   - Never closes a property transaction or gives legal advice.
   - Detects STOP/opt-out before any downstream action.

3. **Qualification Engine**
   - Captures minimum real-estate fields: intent (buy/rent), property type, zone, budget, timeline, name/contact consent.
   - Produces a bounded lead score from explicit rules first; LLM may assist language understanding but cannot override policy gates.

4. **CRM / Evidence Store**
   - Supabase/Postgres adapter for contacts, conversations, qualification snapshots, appointments, handoffs, opt-outs, and audit events.
   - No secrets or full message bodies in logs by default; sensitive content minimized.

5. **WhatsApp Adapter**
   - Interface-first design with `FakeWhatsAppAdapter` for tests and `MetaCloudWhatsAppAdapter` for staging.
   - Outbound sends fail closed if token/configuration is absent.

6. **Human Handoff**
   - Generates a lead summary for a human operator.
   - Marks conversation as human-controlled when escalated.
   - No autonomous response after handoff unless explicitly returned to agent mode.

7. **Operator Dashboard**
   - Minimal dashboard showing: inbound leads, qualification status, hot leads, appointments, opt-outs, handoffs, response time and funnel counts.
   - No vanity metric is treated as revenue proof.

## 4. Recommended integration path
### Chosen approach: Meta WhatsApp Cloud API directly
Reason: lowest architectural dependency, preserves ownership of the integration layer, supports webhook-driven operation, and avoids building the core product around a reseller/BSP abstraction.

### Rejected for the first slice
- **Twilio/BSP-first:** useful fallback if Meta onboarding blocks the pilot number, but adds provider-specific coupling and variable per-message/provider economics.
- **Unofficial WhatsApp Web automation:** rejected because it is not appropriate for a production-oriented commercial asset and creates account/compliance risk.

A provider abstraction remains mandatory so a BSP can be inserted later without changing orchestration logic.

## 5. Data model
Minimum tables/collections:
- `wa_contacts`
- `wa_conversations`
- `wa_messages_meta` (metadata only by default)
- `wa_qualification_snapshots`
- `wa_appointments`
- `wa_handoffs`
- `wa_opt_outs`
- `wa_audit_events`

Every row must carry `organization_id`, timestamps, source channel, and evidence/audit identifiers where applicable. No CASCADE deletion for audit/evidence records.

## 6. Security and governance
- Secrets only through environment variables / deployment secret store.
- Webhook verification required.
- Least privilege for WhatsApp and database credentials.
- PII minimization and redacted logs.
- STOP/opt-out is immediate and terminal for outbound automation until explicit re-consent.
- Maximum three automated follow-ups in the pilot.
- Legal/financial/contractual questions escalate to a human.
- Invented prices, guarantees, availability or property claims are blocked.
- Human kill switch disables outbound automation without disabling evidence access.
- Append-only audit trail for control events.

## 7. Demo scenario
A tester sends: “Bonjour, je cherche une parcelle vers Calavi, budget 12 millions.”

Expected behavior:
1. Webhook ingests the message.
2. Contact/conversation is created or resumed.
3. Agent acknowledges and requests missing qualification fields.
4. CRM persists explicit answers.
5. Rule engine marks lead temperature.
6. If qualified, agent proposes an appointment/visit window.
7. Human operator receives a concise lead summary.
8. Dashboard reflects the funnel transition.
9. A STOP message immediately blocks future automated messages.

## 8. Definition of DEMO READY
All conditions must be true:
- test suite green;
- webhook verification test green;
- simulated end-to-end test green;
- one real inbound message received on the pilot number through an approved WhatsApp Business Platform connection;
- one real governed outbound reply sent;
- CRM record created;
- handoff visible;
- STOP/opt-out live test passes;
- no secret committed;
- logs redact phone/message content outside the minimum evidence fields;
- rollback/kill switch tested;
- staging healthcheck available.

## 9. Commercial gate
Before DEMO READY, messaging to prospects may offer a diagnostic and upcoming pilot, but must not claim that the system is already deployed or live with clients.

After DEMO READY, the commercial pilot may be sold as a 60-day controlled deployment with human supervision. Production client onboarding remains a separate gate from the demo.

## 10. Out of scope for this slice
- autonomous property recommendation engine;
- payments;
- contract generation/signature;
- legal advice;
- voice notes/audio transcription;
- multi-tenant billing;
- bulk marketing campaigns;
- generalized Agent Factory UI.

## 11. Evidence chain
Every release decision must preserve:
`commit SHA → test output → deployment target → healthcheck → WhatsApp event evidence → CRM evidence → control-gate evidence → commercial claim boundary`.

## 12. Recovery principle
If the historical BP-0001 archive becomes available, recover contracts/tests where compatible. Do not blindly copy old code. The active repository and current governance rules are authoritative; recovered behavior must be re-proven by current tests.
