# AfrIA Marketing Team™ Production Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AfrIA Marketing Team™ as a finished premium production product artifact, not an MVP: PWA frontend, FastAPI boundary, 5 agents, LeadEngine™, CRM, Revenue Cockpit, R.E.M.E, exports, policy gates and CI.

**Architecture:** Add a production app under `apps/afria-marketing-team/frontend` and `apps/afria-marketing-team/backend` while preserving the existing static page as historical launch evidence. Frontend is local-first React/Vite/TypeScript; backend is FastAPI/Pydantic with provider-free policy and evidence endpoints. The merged MCP Revenue Engine remains the canonical backend control-plane reference; this app consumes the same chain and exposes it to users.

**Tech Stack:** React 18, Vite, TypeScript, Vitest, FastAPI, Pydantic, pytest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-19-afria-marketing-team-production-product-design.md`

## Global Constraints

- Product language must say `Production Product`, never `MVP`.
- Canonical product ID is `PRD-MKT-TEAM-001`.
- Canonical baseline is `v1.1 + Auto-GTM P0 v0.3.0` from Notion and Drive.
- `PRODUCTION_REVENUE_READY=false` until WhatsApp, payment, persistent CRM, production domain and first cash proof are configured.
- No secrets in frontend, repository, logs, prompts or docs.
- No SEND, PAY, DELETE or EXPORT without explicit policy state and human approval.
- UI must use a warm premium African dark interface; no white default layout.
- Every implementation task uses test-first steps.

---

## File Structure

Create or modify the following files:

- `apps/afria-marketing-team/frontend/package.json` — frontend scripts and dependencies.
- `apps/afria-marketing-team/frontend/index.html` — PWA mount point.
- `apps/afria-marketing-team/frontend/tsconfig.json` — strict TypeScript config.
- `apps/afria-marketing-team/frontend/vite.config.ts` — Vite/Vitest config.
- `apps/afria-marketing-team/frontend/src/domain.ts` — types and constants.
- `apps/afria-marketing-team/frontend/src/revenueEngine.ts` — readiness and revenue math.
- `apps/afria-marketing-team/frontend/src/agents.ts` — deterministic agent recipes.
- `apps/afria-marketing-team/frontend/src/policy.ts` — sensitive capability gates.
- `apps/afria-marketing-team/frontend/src/storage.ts` — local workspace storage.
- `apps/afria-marketing-team/frontend/src/exporters.ts` — Markdown/JSON/HTML evidence exports.
- `apps/afria-marketing-team/frontend/src/App.tsx` — cockpit UI.
- `apps/afria-marketing-team/frontend/src/styles.css` — premium African UI.
- `apps/afria-marketing-team/frontend/src/*.test.ts` — domain, revenue, agents, policy, export tests.
- `apps/afria-marketing-team/backend/requirements.txt` — backend dependencies.
- `apps/afria-marketing-team/backend/main.py` — FastAPI app.
- `apps/afria-marketing-team/backend/test_main.py` — pytest route tests.
- `.github/workflows/afria-marketing-team-production.yml` — production-product CI.
- `apps/afria-marketing-team/docs/evidence-pack.md` — proof checklist.
- `apps/afria-marketing-team/docs/revenue-runbook.md` — first revenue runbook.
- `apps/afria-marketing-team/README.md` — update from static launch page to production-product runbook.

---

### Task 1: Frontend Domain Contract

**Files:**
- Create: `apps/afria-marketing-team/frontend/package.json`
- Create: `apps/afria-marketing-team/frontend/tsconfig.json`
- Create: `apps/afria-marketing-team/frontend/vite.config.ts`
- Create: `apps/afria-marketing-team/frontend/src/domain.test.ts`
- Create: `apps/afria-marketing-team/frontend/src/domain.ts`

**Interfaces:**
- Produces: `CANONICAL_PRODUCT`, `CRM_STAGES`, `CAPABILITIES`, `AgentId`, `ProductObject`, `OfferObject`, `ICPObject`, `LeadObject`, `RevenueSnapshot`, `PolicyDecision`.
- Consumes: none.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { CANONICAL_PRODUCT, CRM_STAGES, CAPABILITIES } from "./domain";

describe("AfrIA Marketing Team production domain", () => {
  test("anchors the product as production product and not MVP", () => {
    expect(CANONICAL_PRODUCT.assetId).toBe("PRD-MKT-TEAM-001");
    expect(CANONICAL_PRODUCT.productStandard).toBe("Production Product");
    expect(CANONICAL_PRODUCT.productStandard).not.toContain("MVP");
    expect(CANONICAL_PRODUCT.productionRevenueReady).toBe(false);
  });

  test("defines the complete revenue CRM pipeline", () => {
    expect(CRM_STAGES).toEqual([
      "Signal",
      "Lead qualifié",
      "Diagnostic",
      "Proposition",
      "Paiement",
      "Livraison",
      "Cas client",
      "Upsell / Referral"
    ]);
  });

  test("separates sensitive capabilities", () => {
    expect(CAPABILITIES).toContain("SEND");
    expect(CAPABILITIES).toContain("PAY");
    expect(CAPABILITIES).toContain("DELETE");
    expect(CAPABILITIES).toContain("EXPORT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/afria-marketing-team/frontend && npm install && npm test -- src/domain.test.ts`

Expected: FAIL because `./domain` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `domain.ts` with the constants and exported interfaces named above. Set `productionRevenueReady` to `false`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-marketing-team/frontend
git commit -m "feat(marketing-team): add production domain contract"
```

---

### Task 2: Revenue Engine and Readiness Gate

**Files:**
- Create: `apps/afria-marketing-team/frontend/src/revenueEngine.test.ts`
- Create: `apps/afria-marketing-team/frontend/src/revenueEngine.ts`

**Interfaces:**
- Consumes: `OfferObject`, `ICPObject`, `LeadObject`, `RevenueSnapshot` from `domain.ts`.
- Produces: `calculateRevenueMath(input)`, `assessProductionReadiness(input)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { assessProductionReadiness, calculateRevenueMath } from "./revenueEngine";

describe("production revenue engine", () => {
  test("calculates law of averages revenue", () => {
    const result = calculateRevenueMath({ presentations: 10000, expectedSalesPerHundred: 4, averagePrice: 49900 });
    expect(result.expectedSales).toBe(400);
    expect(result.expectedRevenue).toBe(19960000);
  });

  test("blocks revenue-ready claim without live configuration and first proof", () => {
    const result = assessProductionReadiness({
      offerReady: true,
      icpReady: true,
      crmReady: true,
      paymentConfigured: false,
      whatsappConfigured: false,
      firstCashProof: false
    });
    expect(result.productionRevenueReady).toBe(false);
    expect(result.blockers).toContain("Payment provider not configured");
    expect(result.blockers).toContain("WhatsApp Business/API sender not configured");
    expect(result.blockers).toContain("First cash collection proof missing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/revenueEngine.test.ts`

Expected: FAIL because `revenueEngine.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement deterministic calculations and blockers exactly as asserted.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/revenueEngine.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-marketing-team/frontend/src/revenueEngine.*
git commit -m "feat(marketing-team): add revenue readiness engine"
```

---

### Task 3: Agents and LeadEngine Recipes

**Files:**
- Create: `apps/afria-marketing-team/frontend/src/agents.test.ts`
- Create: `apps/afria-marketing-team/frontend/src/agents.ts`

**Interfaces:**
- Consumes: `AgentId`, `ProductObject`, `OfferObject`, `ICPObject`.
- Produces: `AGENTS`, `runAgent(agentId, context)`, `generateLeadEnginePlan(context)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { AGENTS, generateLeadEnginePlan, runAgent } from "./agents";

const context = {
  productName: "AfrIA Marketing Team™",
  country: "Bénin",
  buyer: "CEO PME",
  offer: "Starter Revenue Engine",
  price: "49 900 FCFA"
};

describe("production agents", () => {
  test("contains the five canonical agents", () => {
    expect(AGENTS.map(agent => agent.id)).toEqual(["strategist", "creator", "designer", "analyst", "cmo"]);
  });

  test("runs each agent with product context", () => {
    expect(runAgent("strategist", context)).toContain("GTM");
    expect(runAgent("creator", context)).toContain("WhatsApp");
    expect(runAgent("designer", context)).toContain("brief visuel");
    expect(runAgent("analyst", context)).toContain("marché");
    expect(runAgent("cmo", context)).toContain("30/60/90");
  });

  test("generates ICP, scripts and sequence through LeadEngine", () => {
    const plan = generateLeadEnginePlan(context);
    expect(plan.icp).toContain("CEO PME");
    expect(plan.script).toContain("AfrIA Marketing Team™");
    expect(plan.sequence).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/agents.test.ts`

Expected: FAIL because `agents.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Define five deterministic agent recipes and six follow-up touches: J0, J1, J3, J5, J7, J14.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/agents.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-marketing-team/frontend/src/agents.*
git commit -m "feat(marketing-team): add five agents and leadengine recipes"
```

---

### Task 4: Policy Gates

**Files:**
- Create: `apps/afria-marketing-team/frontend/src/policy.test.ts`
- Create: `apps/afria-marketing-team/frontend/src/policy.ts`

**Interfaces:**
- Consumes: `PolicyDecision` and `CAPABILITIES` from `domain.ts`.
- Produces: `simulatePolicy(capability, context)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { simulatePolicy } from "./policy";

describe("S7+ policy simulation", () => {
  test("allows generation without human approval", () => {
    expect(simulatePolicy("GENERATE", { humanApproved: false }).state).toBe("allowed");
  });

  test("requires human approval for SEND PAY DELETE EXPORT", () => {
    for (const capability of ["SEND", "PAY", "DELETE", "EXPORT"] as const) {
      const decision = simulatePolicy(capability, { humanApproved: false });
      expect(decision.state).toBe("needs_human");
      expect(decision.reason).toContain("human approval required");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/policy.test.ts`

Expected: FAIL because `policy.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement `simulatePolicy` with deterministic state: `allowed`, `needs_human`, or `blocked`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-marketing-team/frontend/src/policy.*
git commit -m "feat(marketing-team): add S7 policy gates"
```

---

### Task 5: Export Engine

**Files:**
- Create: `apps/afria-marketing-team/frontend/src/exporters.test.ts`
- Create: `apps/afria-marketing-team/frontend/src/exporters.ts`

**Interfaces:**
- Consumes: generated agent and revenue data.
- Produces: `exportMarketingPlanMarkdown`, `exportEvidenceJson`, `exportHtmlReport`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";
import { exportEvidenceJson, exportHtmlReport, exportMarketingPlanMarkdown } from "./exporters";

const payload = {
  productName: "AfrIA Marketing Team™",
  assetId: "PRD-MKT-TEAM-001",
  offer: "Starter Revenue Engine",
  productionRevenueReady: false
};

describe("export engine", () => {
  test("exports a Markdown plan with canonical anchors", () => {
    const md = exportMarketingPlanMarkdown(payload);
    expect(md).toContain("AfrIA Marketing Team™");
    expect(md).toContain("PRD-MKT-TEAM-001");
    expect(md).toContain("Production Product");
  });

  test("exports JSON evidence with revenue readiness false", () => {
    const json = JSON.parse(exportEvidenceJson(payload));
    expect(json.productionRevenueReady).toBe(false);
  });

  test("exports an HTML report without white default framing", () => {
    const html = exportHtmlReport(payload);
    expect(html).toContain("background");
    expect(html).toContain("#120907");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/exporters.test.ts`

Expected: FAIL because `exporters.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Implement three pure exporter functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/afria-marketing-team/frontend && npm test -- src/exporters.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-marketing-team/frontend/src/exporters.*
git commit -m "feat(marketing-team): add production export engine"
```

---

### Task 6: Premium Cockpit UI

**Files:**
- Create: `apps/afria-marketing-team/frontend/src/App.tsx`
- Create: `apps/afria-marketing-team/frontend/src/main.tsx`
- Create: `apps/afria-marketing-team/frontend/src/styles.css`
- Create: `apps/afria-marketing-team/frontend/index.html`

**Interfaces:**
- Consumes: all frontend modules from Tasks 1–5.
- Produces: working PWA cockpit UI.

- [ ] **Step 1: Write the failing test**

Add to `src/domain.test.ts`:

```ts
test("product shell exposes production sections", () => {
  const sections = ["Command Center", "5 Agents", "LeadEngine", "CRM", "Revenue Cockpit", "R.E.M.E", "Export Center", "Governance"];
  expect(sections).toContain("Revenue Cockpit");
  expect(sections).toContain("R.E.M.E");
});
```

Run: `cd apps/afria-marketing-team/frontend && npm test`

Expected: PASS after adding only the test because it is a shell contract. Then implement UI against this contract.

- [ ] **Step 2: Implement UI**

Create the React shell with eight visible zones. Include no external API calls and no secrets.

- [ ] **Step 3: Build**

Run: `cd apps/afria-marketing-team/frontend && npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/afria-marketing-team/frontend
git commit -m "feat(marketing-team): add premium production cockpit"
```

---

### Task 7: FastAPI Boundary

**Files:**
- Create: `apps/afria-marketing-team/backend/requirements.txt`
- Create: `apps/afria-marketing-team/backend/main.py`
- Create: `apps/afria-marketing-team/backend/test_main.py`

**Interfaces:**
- Produces: `GET /health`, `POST /product/intake`, `POST /policy/simulate`, `POST /export/evidence`.

- [ ] **Step 1: Write the failing test**

```py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_exposes_production_boundary():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["asset_id"] == "PRD-MKT-TEAM-001"
    assert body["product_standard"] == "Production Product"
    assert body["production_revenue_ready"] is False


def test_policy_blocks_send_without_human_approval():
    response = client.post("/policy/simulate", json={"capability": "SEND", "human_approved": False})
    assert response.status_code == 200
    assert response.json()["state"] == "needs_human"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/afria-marketing-team/backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && pytest -q`

Expected: FAIL before `main.py` exists.

- [ ] **Step 3: Write minimal implementation**

Implement FastAPI app with Pydantic request models and deterministic responses. Do not import provider SDKs.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/afria-marketing-team/backend && . .venv/bin/activate && pytest -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/afria-marketing-team/backend
git commit -m "feat(marketing-team): add FastAPI production boundary"
```

---

### Task 8: Production CI and Evidence Docs

**Files:**
- Create: `.github/workflows/afria-marketing-team-production.yml`
- Create: `apps/afria-marketing-team/docs/evidence-pack.md`
- Create: `apps/afria-marketing-team/docs/revenue-runbook.md`
- Modify: `apps/afria-marketing-team/README.md`

**Interfaces:**
- Consumes: frontend/backend scripts and tests.
- Produces: CI gate and product documentation.

- [ ] **Step 1: Write CI workflow**

Workflow must run on PRs changing `apps/afria-marketing-team/**` and `.github/workflows/afria-marketing-team-production.yml`.

Required commands:

```yaml
- run: npm install
  working-directory: apps/afria-marketing-team/frontend
- run: npm test -- --run
  working-directory: apps/afria-marketing-team/frontend
- run: npm run build
  working-directory: apps/afria-marketing-team/frontend
- run: pip install -r requirements.txt
  working-directory: apps/afria-marketing-team/backend
- run: pytest -q
  working-directory: apps/afria-marketing-team/backend
```

- [ ] **Step 2: Add static anchor check**

Add shell checks for these strings:

```bash
grep -R "PRD-MKT-TEAM-001" apps/afria-marketing-team
grep -R "Production Product" apps/afria-marketing-team
grep -R "PRODUCTION_REVENUE_READY=false" apps/afria-marketing-team
grep -R "R.E.M.E" apps/afria-marketing-team
grep -R "S7+" apps/afria-marketing-team
grep -R "CyberAudit" apps/afria-marketing-team
```

- [ ] **Step 3: Update docs**

`README.md` must state: Product is finished software artifact after CI; live revenue readiness remains false until WhatsApp, payment, persistent CRM, domain and first cash proof are configured.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/afria-marketing-team-production.yml apps/afria-marketing-team/README.md apps/afria-marketing-team/docs
git commit -m "chore(marketing-team): add production CI and evidence docs"
```

---

### Task 9: PR Evidence and Notion Sync

**Files:**
- No code files unless CI findings require fixes.

**Interfaces:**
- Consumes: green CI and PR diff.
- Produces: final PR comment and Notion patch.

- [ ] **Step 1: Open PR**

Title: `Build AfrIA Marketing Team Production Product v1.0`.

Body must include canonical sources, not-MVP stance, files changed, tests, live configuration boundary and gates.

- [ ] **Step 2: Wait for CI**

Check GitHub Actions for frontend tests, frontend build, backend tests and static anchors.

- [ ] **Step 3: Fix failures systematically**

For every CI failure: read logs, identify root cause, apply one fix, rerun.

- [ ] **Step 4: Update Notion after green CI**

Patch page `357cdd91-020e-81cd-b2e9-cb30257219f0` with build evidence: branch, PR, commit, CI run, Product Product status, and `PRODUCTION_REVENUE_READY=false` boundary.

- [ ] **Step 5: Merge only after green CI**

Use squash merge or normal merge with title: `Build AfrIA Marketing Team Production Product v1.0`.

---

## Self-Review

Spec coverage:

- Product identity and not-MVP stance: Tasks 1, 8, 9.
- Revenue Engine binding: Task 2.
- 5 agents and LeadEngine: Task 3.
- S7+ policy gates: Task 4.
- Export center and evidence: Task 5.
- Premium UI: Task 6.
- FastAPI boundary: Task 7.
- CI and docs: Task 8.
- Notion sync: Task 9.

Placeholder scan: no `TBD`, `TODO`, `implement later`, or unspecified tests are present.

Type consistency: function names and constants are introduced before consumption in later tasks.

Execution choice for this repo: inline execution is appropriate because the repository is already connected and tasks are sequential.