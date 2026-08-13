# GENESIS V4 Continental Skill Factory — Design

Date: 2026-08-13
Status: CEO-approved architecture, implementation spec
Repository: `lanickbusiness1/newlife`
Branch: `genesis-v4-continental-skill-factory`

## Problem

GENESIS V4 needs a governed skill factory that can learn from country deployments, reuse prior skills, contextualize them with STRATEX-99, qualify the concrete initiative with STRATEX-9, and promote proven skills from institution/country scope toward regional/domain/core scope.

There is currently source-of-truth drift: Notion documents a Skill Factory/Registry implementation, while GitHub `main` MCP v0.2 contains only the Revenue Engine and no `skillFactory.ts`. The implementation must therefore restore executable parity without pretending that undocumented production proof exists.

## Design principles

1. Extend the existing MCP service; do not create a new product or framework.
2. Preserve GENESIS universal invariants while contextualizing every territorial skill.
3. STRATEX-99 contextualizes the environment; STRATEX-9 qualifies the concrete project/use case.
4. Registry-first: search for reusable skills before creating a new one.
5. If an existing skill covers at least 80% of the requested capability, extend or compose it instead of cloning it.
6. Country differences live in Context/Policy Packs and connectors, not hard-coded in universal core skills.
7. Sensitive scopes remain M8-gated; alert-first applies only to bounded non-sensitive deviations.
8. Every installation and promotion is auditable and reversible.

## Skill hierarchy

- L0 Core Skill — universal, country-independent.
- L1 Domain Skill — GovTech, health, fintech, agriculture, etc.
- L2 Regional Skill — MRU, ECOWAS, UEMOA, CEMAC, EAC, etc.
- L3 Country Skill — national law, institutions, language, rails, constraints.
- L4 Institution Skill — agency/ministry/operator adaptation.
- L5 Transaction Skill — atomic reusable task.

## Skill DNA

Each skill carries:

- id, version, level, parent ids/composition ids;
- domain, region, country, institution scope;
- problem, triggers, inputs, outputs and dependencies;
- permission scopes and risk classification;
- STRATEX-99 context reference and coverage;
- STRATEX-9 qualification reference/status;
- language/localization and jurisdiction metadata;
- online/offline/edge strategy;
- R.E.M.E evidence references;
- tests/evaluations and success metrics;
- rollback/kill-switch metadata;
- M6/S7+/M8/double-review status;
- lifecycle status and deprecation metadata.

## STRATEX-99 Territorial Context Vector

Context is represented through the existing nine STRATEX-99 layers, with subdimensions including:

1. Language & Semantic — official/local languages, terminology, literacy, tone.
2. Regulatory & Legal — laws, tax, data, AI, labor, procurement, IP, contracts.
3. Institutional — ministries, regulators, central banks, procurement authorities, local government.
4. Economic, Financial & Payment — currency, FX, inflation, purchasing power, payment rails, financing.
5. Cultural, Human & Adoption — customs, trust, negotiation, authority, inclusion, behavior.
6. Infrastructure & Resilience — geography, connectivity, energy, cloud/data centers, offline constraints, climate/resilience.
7. Market, Business & Revenue — market structure, pricing, distribution, partners, revenue viability.
8. Technology, Data & Agentic AI — architecture, models, APIs, data schemas, interoperability, observability.
9. Governance, Sovereignty & Assurance — permissions, audit, M6/S7+/M8, sovereignty, human accountability.

Historical/scientific/local knowledge is represented as evidence/metadata under the relevant layers rather than adding a tenth STRATEX-99 layer.

## Components

### `skillFactory.ts`
Pure deterministic compiler and governance engine.

Responsibilities:
- validate Skill DNA;
- detect dangerous/destructive content;
- detect sensitive domains;
- evaluate M6/S7+/M8 state;
- classify output as `draft_ready`, `alert_ready`, `m8_required`, or `blocked`;
- compute compatibility score against registry candidates;
- enforce 80% reuse threshold;
- validate promotion prerequisites.

### `skillRegistry.ts`
Filesystem-backed registry abstraction with deterministic JSON records and SHA-256 integrity metadata.

Responsibilities:
- list/read/install skills;
- exact id/version lookup;
- compatibility matching;
- immutable install record metadata;
- lifecycle/deprecation fields;
- no installation of `blocked` skills;
- double review or M8 requirements enforced by installer.

Production note: local filesystem persistence is staging-grade until durable volume, backup, restore and deployment proof exist.

### `countryCompiler.ts`
Composes a deployable skill from reusable layers:

`Core + Domain + Regional + Country Context/Policy Pack + Institution + Transaction`.

It must reject compositions with missing required context coverage or incompatible jurisdiction constraints.

### MCP exposure

Add tools under existing RequestContext authorization:

- `genome.skill_factory.compile`
- `genome.skill_factory.match`
- `genome.skill_factory.install`
- `genome.skill_factory.promote`
- `genome.skill_registry.list`
- `genome.skill_registry.read`
- `genome.country_compiler.compile`

Required scopes remain least-privilege and explicit.

## Data flow

`Signal → STRATEX-99 Context Pack → STRATEX-9 qualification → Registry match → reuse/compose OR compile gap → tests/governance → canary-ready record → evidence → promotion decision → Registry`.

## Promotion rules

A local skill can be promoted only if:

- outcome evidence exists;
- local rules are separated from generic logic;
- no national legal rule is hard-coded in L0/L1 core;
- permission/data scope is bounded;
- second-context parameterization test passes for promotion beyond country scope;
- double review passes;
- sensitive risk remains under M8/human governance;
- rollback path exists.

## MRU first validation path

First domain: public procurement/GovTech.

Initial reusable capabilities:
- tender publication;
- supplier onboarding/KYB;
- supplier credential/passport verification;
- bid compliance evaluation;
- procurement anomaly detection;
- contract/milestone/invoice/payment evidence;
- audit bundle generation;
- cross-border document verification;
- offline synchronization/recovery.

Validation sequence: Liberia → Sierra Leone → Guinea → Côte d’Ivoire → MRU regional promotion candidate → ECOWAS candidate.

## Error handling

Fail closed for:
- missing context for territorial skills;
- missing STRATEX-9 qualification on territorial execution;
- destructive instructions/secrets;
- sensitive scope without M8 context;
- invalid promotion or jurisdiction leakage;
- registry integrity mismatch.

Non-sensitive incomplete quality deviations may return `alert_ready` with explicit warnings and mandatory double review.

## Testing strategy

TDD first. Tests cover:

- Skill DNA validation;
- sensitive vs non-sensitive governance states;
- destructive content blocking;
- 80% reuse threshold;
- no country hard-coding in core promotion;
- context coverage requirements;
- country composition precedence;
- second-country promotion rule;
- registry SHA-256 integrity;
- install authorization by status;
- deprecation/read behavior;
- MCP tool registration smoke path;
- health metadata.

## Release boundary

This increment may claim only: code implemented, tests/typecheck/build passing, and GitHub CI proof if observed.

It must NOT claim production until Docker image build, deployed runtime, monitoring, persistent registry storage, backup/restore and rollback are all proven.

## Success criteria

- GitHub becomes executable source of truth for the Skill Factory.
- Territorial skill compilation cannot bypass STRATEX-99/STRATEX-9.
- Registry reuse prevents uncontrolled country cloning.
- Country compiler composes contextualized skills without polluting universal core.
- Tests demonstrate governance and promotion rules.
- Notion is updated only with evidence actually produced by GitHub/CI.
