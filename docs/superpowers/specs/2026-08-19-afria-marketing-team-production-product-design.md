# AfrIA Marketing Team™ Production Product v1.0 — Design Spec

Status: CEO-approved production-product build scope, not MVP.
Date: 2026-08-19.
Owner: AfrIAgenesis® / Lanick Mohamed.
Canonical product: `PRD-MKT-TEAM-001`.
Target branch: `afria-marketing-team-production-product`.

## 1. Canonical sources and evidence

This design starts from the latest canonical Notion product page for `AfrIA Marketing Team™`, not from the previously merged static MVP page.

Confirmed sources:

- Notion product page: `AfrIA Marketing Team™`, page id `357cdd91-020e-81cd-b2e9-cb30257219f0`.
- Canonical Asset ID: `PRD-MKT-TEAM-001`.
- Notion state: `SOURCE_PROVEN`, `Construit`, `Déployable`, `Déployé Prod: NO`.
- Notion version: `v1.1 + Auto-GTM P0 v0.3.0`.
- Drive blueprint: `Blueprint technique P0 — AfrIA Marketing Team Auto-GTM Mode v1.0`.
- Drive master build prompt: `Master Build Prompt — AfrIA Marketing Team Auto-GTM Mode P0 v1.0`.
- Current GitHub base: `main`, post Revenue Engine v0.3.0 and post static cash landing.

Non-negotiable interpretation: the existing static `apps/afria-marketing-team/index.html` is a launch placeholder only. It must not define the production architecture and must not be called MVP in product language.

## 2. Product standard

AfrIA Marketing Team™ is a proprietary production product. It must be treated as a finished, premium commercial operating system for marketing, sales and revenue activation across AfrIAgenesis® products.

The production product must include:

- Premium PWA shell with African warm palette and no white-background default interface.
- 5 operating agents: Strategist, Creator, Designer, Analyst, AI CMO.
- LeadEngine™ layer: ICP generation, campaign planning, script generation, prospect stage movement and revenue follow-up.
- Revenue cockpit: leads, diagnostics, proposals, payments, revenue, conversion rate, relance status and proof status.
- CRM pipeline: Signal → Lead qualifié → Diagnostic → Proposition → Paiement → Livraison → Cas client → Upsell / Referral.
- Revenue Engine binding: Product → Offer → ICP → Proof → Channel → Script → CRM → Sequence → Payment → First revenue → Case study → Upsell → Scale / Correct / Kill.
- R.E.M.E learning loop: objections, winning messages, proof assets, campaign learnings and reusable lessons.
- Export engine: copy-ready scripts, Markdown plan, JSON evidence pack and PDF-ready HTML report.
- Policy layer: no SEND, PAY, DELETE or EXPORT without visible policy status and human approval flag.
- Backend boundary: FastAPI service for health, product intake, policy simulation, export payload normalization and future provider adapters.
- Deployment readiness: Vite build, FastAPI import tests, static production checks, CI workflow and runbook.

## 3. Boundaries and explicit NO-GO rules

Production Product v1.0 can be merged when build, tests and evidence pass. It must still remain `PRODUCTION_REVENUE_READY = false` until live external configuration is provided and verified.

No-go rules:

- Do not claim live production revenue readiness without real WhatsApp Business/API number, payment account, persistent CRM and proof of first cash collection.
- Do not put API keys, tokens, Anthropic keys, WhatsApp credentials, provider secrets or payment secrets in frontend, repo, logs or prompts.
- Do not send real outbound messages in P0. Production Product v1.0 may generate drafts and approval packets, but SEND remains gated.
- Do not trigger real payments in P0. Payment link configuration may be modeled and validated, but PAY remains gated.
- Do not rebuild a global prospect database.
- Do not create a new product line named Auto-GTM; Auto-GTM remains an internal mode/capability of AfrIA Marketing Team™.
- Do not replace the canonical Notion product page with code-only truth. Code becomes evidence, not canon by itself.

## 4. Architecture

### Frontend

Path: `apps/afria-marketing-team/frontend`.

Stack:

- React 18.
- Vite 5/6 acceptable, but keep package versions explicit.
- TypeScript.
- Local-first persistence through browser storage for the first production product pass.
- No secret-bearing environment variables in frontend.

Frontend modules:

- `src/domain.ts`: product, offer, ICP, CRM, campaign, revenue and R.E.M.E types.
- `src/revenueEngine.ts`: deterministic product readiness and revenue math derived from the merged MCP revenue-engine logic.
- `src/agents.ts`: 5 agent definitions and output recipes.
- `src/policy.ts`: capability gates for GENERATE, PROPOSE, WRITE, SEND, PAY, EXPORT, DELETE.
- `src/storage.ts`: local tenant workspace persistence.
- `src/exporters.ts`: Markdown, JSON evidence and HTML report exports.
- `src/App.tsx`: orchestrated cockpit UI.
- `src/styles.css`: premium dark African UI.

### Backend

Path: `apps/afria-marketing-team/backend`.

Stack:

- Python FastAPI.
- Pydantic models.
- Pytest.
- No external provider dependency in P0.

Backend endpoints:

- `GET /health`: returns service version, canonical product id, production readiness flags and policy gates.
- `POST /product/intake`: normalizes offer, market and buyer data into a ProductObject.
- `POST /policy/simulate`: returns allowed/blocked/needs_human for sensitive capabilities.
- `POST /export/evidence`: validates evidence pack payload shape.

### Evidence and docs

Paths:

- `apps/afria-marketing-team/README.md`: production product runbook.
- `apps/afria-marketing-team/docs/evidence-pack.md`: verification checklist and proof run format.
- `apps/afria-marketing-team/docs/revenue-runbook.md`: first revenue execution runbook.

### CI

Path: `.github/workflows/afria-marketing-team-production.yml`.

Checks:

- Frontend install, typecheck, tests and build.
- Backend install and pytest.
- Static anchor checks: `PRD-MKT-TEAM-001`, `Production Product`, `not MVP`, `S7+`, `M6`, `CyberAudit`, `R.E.M.E`, `Revenue Engine`, `PRODUCTION_REVENUE_READY=false`.

## 5. Domain model

Core frontend/backend concepts:

- `ProductObject`: canonical product being marketed.
- `OfferObject`: productized commercial offer with price, currency, promise, deliverable and CTA.
- `ICPObject`: buyer segment, buyer role, geography, pains, urgency and qualification rules.
- `AgentOutput`: generated strategy, content, creative brief, market analysis or CMO plan.
- `CampaignObject`: channel, message variants, approval state, budget/volume cap, stop conditions.
- `LeadObject`: prospect identity, segment, country, score, stage, next action and evidence refs.
- `RevenueSnapshot`: leads, diagnostics, proposals, payments, revenue, conversion rate and expected revenue.
- `RemeLesson`: source event, lesson, evidence, confidence, reuse scope and permission.
- `PolicyDecision`: capability, allowed state, reason, human approval requirement and audit ref.

## 6. User experience

The product opens on a premium executive cockpit, not a landing page only.

Primary zones:

1. Command Center: product identity, target country, active offer, readiness status and next action.
2. 5 Agents Panel: run agent recipes and preview outputs.
3. LeadEngine™: ICP, campaign, script and sequence generation.
4. CRM Board: visual pipeline with lead movement and revenue stage.
5. Revenue Cockpit: expected and actual revenue, conversion math, proof gate and cash collection status.
6. R.E.M.E Panel: objections, lessons, winning messages and next optimization.
7. Export Center: copy scripts, download JSON evidence, copy Markdown plan and prepare PDF-ready report.
8. Governance Strip: S7+, M6, CyberAudit, M8 and Big4 states.

## 7. Finished-product acceptance criteria

A build qualifies as Production Product v1.0 only when all of the following are true:

- App builds with Vite and TypeScript.
- Backend imports and FastAPI routes pass pytest.
- Product copy contains no MVP framing.
- The UI has the 5 agents operational as deterministic generators.
- The LeadEngine generates ICP, scripts, sequence and campaign plan from user input.
- CRM stages are persisted locally and visible.
- Revenue cockpit computes expected sales and expected revenue from law-of-averages inputs.
- Sensitive capabilities are blocked or marked `needs_human` unless explicitly approved.
- Export center produces Markdown and JSON evidence.
- Documentation states remaining live configuration boundaries.
- CI passes.
- Notion can be updated with build evidence after CI green.

## 8. Live configuration boundary

These items are intentionally not hardcoded and remain post-merge configuration tasks:

- WhatsApp Business/API sender.
- Payment provider account and live links.
- Persistent CRM backend or external CRM connector.
- Anthropic/OpenAI/provider secrets.
- Production domain and TLS deployment target.
- First paid client proof.

The product can be a finished software artifact while still honestly stating `PRODUCTION_REVENUE_READY=false` until these external controls are configured and verified.

## 9. Implementation mode

Implementation must use TDD task-by-task. The first implementation plan must create tests before production code and must preserve the canonical sources above. The previous static page can be retained as legacy reference only if the production app takes precedence through docs and workflow naming.