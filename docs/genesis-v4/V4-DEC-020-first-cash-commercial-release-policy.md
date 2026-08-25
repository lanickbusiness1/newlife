# V4-DEC-020 — First Cash Commercial Release Policy™

**Decision date:** 2026-08-25  
**Status:** CANONICAL / ACTIVE  
**Scope:** AfrIAgenesis® commercial applications and sellable capabilities  
**Authority:** CEO decision — revenue-first correction to release governance

## 1. Decision

AfrIAgenesis® separates **commercial readiness** from **terminal production assurance**.

Internal controls such as M8, S7+, Independent Assurance Council™, Big4-style review, real-data E2E and `PRODUCTION_PROVEN` MUST NOT become automatic blockers to prospecting, contracting, invoicing, collection or a bounded paid pilot when the sellable scope already has sufficient technical evidence for that pilot.

Canonical first-cash sequence:

`SIGNAL → OFFER → SELL → CONTRACT → COLLECT → PAID PILOT → DELIVER → EVIDENCE → CASE STUDY → HARDEN → SCALE`

The old anti-pattern is forbidden:

`BUILD → INTERNAL GATES FOREVER → NO CUSTOMER → NO CASH`.

## 2. Commercial readiness states

### READY_TO_SELL
The offer may be marketed, proposed, contracted and invoiced.

### PAID_PILOT_AUTHORIZED
A bounded paid pilot may be delivered to authorized users on an explicitly described, evidence-backed scope.

### PRODUCTION_PROVEN
A separate terminal truth state. It requires the production/runtime evidence defined by the applicable release contract and MUST NOT be inferred from a sale or pilot.

Commercial authorization does not imply `PRODUCTION_PROVEN`.

## 3. Gates moved after first cash

Unless an external mandate or the specific risk contract says otherwise, the following are **hardening / scale / terminal-production gates**, not first-revenue gates:

- M8 final approval;
- S7+ final approval;
- Independent Assurance Council™ / Big4-style internal assurance;
- external review;
- full real-data E2E;
- terminal deployment proof;
- performance or outcome proof at scale.

They may be required before institution-wide, regulated, sovereign, safety-critical or otherwise high-risk production operation. They do not automatically block a controlled paid pilot.

## 4. Hard blockers that remain non-negotiable

### HARD-CASH-001 — Truth
No fabricated capability, metric, credential, qualification, regulatory status, customer outcome or production status.

### HARD-CASH-002 — Security
Do not bypass authentication, authorization, RLS, secret management, least privilege, rollback controls or material vulnerability gates to accelerate revenue.

### HARD-CASH-003 — Privacy and lawful data use
Consent, purpose limitation, minimization and applicable data-protection/legal obligations remain binding.

### HARD-CASH-004 — External mandate
A law, regulator, contract, customer, funder, certification body or explicit binding governance mandate may impose a gate before sale or use. Such an external mandate overrides this default policy for its scope.

### HARD-CASH-005 — High-impact automated decisions
Where a system makes legally or materially consequential decisions about people, public rights, money, safety or sovereign administration, required human review and applicable legal controls remain active.

## 5. Pilot boundary

A paid pilot must state:

- what is TEST_PROVEN / SOURCE_PROVEN / DOCUMENTED;
- what remains unproven;
- who is authorized to use it;
- data/security boundary;
- success metric and delivery evidence;
- price, payment/collection condition and scope;
- rollback/stop condition where runtime operation is involved.

A paid pilot may generate the real evidence needed to close later M8/S7+/assurance gates.

## 6. Portfolio rule

No agent, workflow, dashboard or release assistant may label an application commercially blocked **solely** because M8, S7+, Big4-style review, independent assurance or `PRODUCTION_PROVEN` is incomplete.

Commercial blocking requires at least one concrete reason:

1. no sellable capability exists yet;
2. the requested pilot scope is not sufficiently evidenced;
3. unresolved security/privacy/legal blocker applies to that pilot;
4. external mandate requires the missing gate;
5. high-impact automation cannot be safely bounded for a pilot.

Otherwise the default action is:

`PACKAGE OFFER → PRICE → PROSPECT → CONTRACT → COLLECT → PILOT`.

## 7. AfrIA Recruit™ application

As first implementation of this policy:

- `PRD-RECRUIT-001` is `READY_TO_SELL + PAID_PILOT_AUTHORIZED`;
- Candidate OS + ATS/Application Readiness + Verified Learning/Credential capability are merged into `main`;
- hard truth/consent/RLS/privacy/evidence controls remain;
- dynamic public production deployment and `PRODUCTION_PROVEN` are not yet claimed.

Main integration commit: `ee4ba1fc3a96356ac416bca9da96d7705c524efa`.

## 8. Control Plane interpretation

Genesis Release-to-Revenue Control Plane™ must distinguish:

- `commercialGate` — can we sell/collect/pilot this bounded offer now?
- `productionGate` — can this exact release be promoted to its target production truth state?

A failed `productionGate` MUST NOT automatically force `commercialGate = BLOCKED`.

## 9. Non-regression

Future governance automation must optimize for **cash with evidence**, not governance theater. Any future rule that again makes internally chosen terminal assurance a blanket prerequisite to first revenue requires an explicit superseding CEO decision.
