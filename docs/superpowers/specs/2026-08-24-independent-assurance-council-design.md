# Independent Assurance Council™ — Design

**Date:** 2026-08-24  
**Status:** CEO-approved design  
**Canonical parent:** `Genesis Release-to-Revenue Control Plane™ / ADR-0007`  
**Canonical asset:** `INF-DEPLOYBOT-001 — DeployBot AfrIAgenesis®`  
**Scope:** Internal assurance capability. No standalone commercial product is created.

## 1. Purpose

Replace the default dependency on an external Big4 reviewer with a rigorous internal, multi-agent independent assurance gate. The term `Big4` becomes a rigor benchmark rather than an organization dependency.

External assurance remains mandatory only when required by law, regulator, contract, funder, client, certification authority, or another explicit external mandate.

## 2. Canonical chain

```text
M6
→ S7+
→ M8
→ Independent Assurance Council™
→ GO | HOLD | BLOCK
→ External assurance only if externalMandate=true
→ controlled merge
→ authorized provider dogfood
→ provider/DNS/TLS/health/rollback/economics evidence
→ PRODUCTION_PROVEN decision
```

## 3. Council composition

Five isolated specialist auditors plus one distinct arbiter:

1. `ARCHITECTURE_RUNTIME_AUDITOR` — architecture, runtime boundaries, state transitions, failure modes, rollback semantics.
2. `SECURITY_SUPPLY_CHAIN_AUDITOR` — dependency, secret, CI/CD, permissions, software supply chain and tamper scenarios.
3. `SOVEREIGNTY_COMPLIANCE_AUDITOR` — data classification, localization, sovereignty, regulatory and contractual controls.
4. `ECONOMICS_FINOPS_AUDITOR` — compute economics, metric provenance/freshness, margin, lock-in, SLA and energy evidence.
5. `ADVERSARIAL_RED_TEAM_AUDITOR` — actively challenges the other assurance claims and searches for bypasses, evidence spoofing and unsafe defaults.
6. `ASSURANCE_ARBITER` — consolidates findings after specialist reviews are sealed. It cannot suppress or downgrade a P0 finding.

The builder or change-authoring agent may supply evidence but cannot be the sole auditor or arbiter for its own change.

## 4. Isolation and evidence model

All auditors receive the same immutable review snapshot:

- repo and PR;
- audited head SHA;
- release version/schema;
- CI run IDs and results;
- test summary;
- relevant source files or diffs;
- M6/S7+/M8 evidence;
- provider policy evidence if available;
- sovereignty and economics evidence.

Specialist auditors must work independently and produce sealed reports before the arbiter sees them. Reports include:

- `auditorRole`;
- `snapshotSha`;
- `findings[]` with severity `P0 | P1 | P2`;
- evidence references;
- `verdict: PASS | HOLD | BLOCK`;
- generated timestamp;
- report SHA-256.

## 5. Decision rule

The gate is deterministic and fail-closed:

```text
if any open P0 => BLOCK
else if any open P1 => HOLD
else if fewer than 4 of 5 specialist auditors PASS => HOLD
else if arbiter verdict != PASS => HOLD/BLOCK according to arbiter
else => INTERNAL_BIG4_PASS
```

The arbiter cannot override an open P0. A P0 can only disappear through remediation followed by a new audit snapshot and rerun.

## 6. External mandate

`externalMandate` is false by default and becomes true only from explicit evidence that a third-party review is required by:

- law or regulation;
- regulator/supervisor;
- contract or procurement requirement;
- client or funder requirement;
- certification/accreditation rule;
- binding governance decision.

If `externalMandate=true`, the internal council still runs first, but release progression becomes:

```text
INTERNAL_BIG4_PASS → EXTERNAL_ASSURANCE_REQUIRED
```

No internal agent may fabricate or self-assert an external sign-off.

## 7. Release Evidence Bundle migration

Replace the ambiguous release gate `gates.big4?: "pass"` with an explicit object:

```ts
interface IndependentAssuranceEvidence {
  schemaVersion: "1.0.0";
  mode: "internal-agentic" | "external";
  verdict: "INTERNAL_BIG4_PASS" | "HOLD" | "BLOCK" | "EXTERNAL_ASSURANCE_REQUIRED" | "EXTERNAL_PASS";
  snapshotSha: string;
  specialistPassCount: number;
  specialistTotal: 5;
  openP0: number;
  openP1: number;
  auditorReportHashes: string[];
  arbiterReportHash: string;
  externalMandate: boolean;
  evidenceRef: string;
}
```

Backward compatibility is temporary: a legacy `gates.big4="pass"` may be read only as legacy evidence during migration, but new release compilation must emit `independentAssurance`.

## 8. Runtime modules

Add a focused `independentAssurance.ts` module under the existing MCP server. It provides deterministic compilation/verification of sealed auditor reports and council decisions. It does not run LLMs by itself; orchestration agents produce reports, while the runtime verifies quorum, severity, hashes, snapshot identity, role uniqueness and external-mandate rules.

Release Center consumes a verified `IndependentAssuranceEvidence` and fails closed for high/regulated releases if it is absent or invalid.

## 9. MCP surface

Expose deterministic tools under the existing governed `deploy:plan` scope:

- `deploybot.assurance.compile_report`
- `deploybot.assurance.compile_council`
- `deploybot.assurance.verify`

No new service, product or control plane is created.

## 10. Security invariants

- exactly one report per required specialist role;
- no duplicate role may count toward quorum;
- all reports must bind to the same `snapshotSha`;
- report hashes must verify;
- P0 is non-overridable;
- P1 prevents PASS;
- minimum specialist quorum is 4/5 PASS;
- arbiter is distinct from specialist roles;
- unknown roles, severities, modes or verdicts fail closed;
- external PASS cannot be generated by an internal-agentic council;
- external mandate cannot be silently downgraded.

## 11. PR #64 migration

PR #64 remains the integration vehicle. Its current `EXTERNAL_ASSURANCE_REQUIRED` semantics are replaced by `INTERNAL_ASSURANCE_REQUIRED` by default. The existing external assurance pack is retained as historical/optional material but is no longer the default blocker.

Before PR #64 can leave draft:

1. council runtime and tests are green;
2. Release Center enforces the new evidence contract;
3. the first internal council is run against the immutable PR #64 head;
4. all P0/P1 findings are remediated and re-run;
5. council verdict is `INTERNAL_BIG4_PASS`;
6. no explicit `externalMandate` exists.

## 12. Proof boundaries

`INTERNAL_BIG4_PASS` is an internal assurance proof, not a legal audit opinion, certification, statutory assurance report or external attestation. `PRODUCTION_PROVEN` remains impossible until real provider, DNS/TLS, healthcheck, rollback and measured economics evidence are collected.