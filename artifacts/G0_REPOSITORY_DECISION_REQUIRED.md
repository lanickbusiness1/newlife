# G0 — AfrIA PaySwitch Repository Decision Required

Date: 2026-07-27
Status: BLOCKED — canonical repository not proven
Gate: G0 Repository Intake

## Executive decision

The connected GitHub installation exposes only one repository owned by the authenticated account: `lanickbusiness1/newlife`.

Under the AfrIA PaySwitch Canonical Master Build Prompt, `lanickbusiness1/newlife` must not be treated as the AfrIA PaySwitch repository unless an explicit documented decision designates it. No repository named or evidenced as AfrIA PaySwitch, `afria-payswitch-sandbox-mvp`, or equivalent was found in the accessible installation.

Therefore:

- no AfrIA PaySwitch application code has been written;
- no payment, MCP, API, ledger, routing, compliance, fraud, reconciliation, or agent module has been added;
- no deployment configuration has been changed;
- this artifact is the only authorized output of G0.

## Repository candidates inspected

| Candidate | Evidence | Result |
|---|---|---|
| `lanickbusiness1/newlife` | Only accessible owned repository; default branch `main`; administrator permission available | REJECTED as canonical PaySwitch repository pending explicit designation |
| `lanickbusiness1/afria-payswitch-sandbox-mvp` | Recommended canonical name in the approved architecture | NOT FOUND / not accessible |
| Any repository containing `payswitch`, `pay-switch`, or `afria-payswitch` | Installed-repository search returned no result | NOT FOUND |

## Canonical recommendation

Create or expose a private repository with the following canonical identity:

- Owner: `lanickbusiness1`
- Repository: `afria-payswitch-sandbox-mvp`
- Visibility: private
- Default branch: `main`
- Working branch: `feat/global-benchmark-mcp-foundation`
- Initial mode: sandbox / simulation / shadow / production-disabled

## Required repository protections

1. Branch protection on `main`.
2. Pull request required before merge.
3. Required CI checks for lint, typecheck, unit tests, contract tests, security tests, migration validation and secret scanning.
4. No production secrets in GitHub.
5. CODEOWNERS for architecture, security, compliance and payment-core paths.
6. Signed or attributable commits where supported.
7. Dependabot or equivalent dependency monitoring.
8. Secret scanning and push protection.
9. Environments separated into `sandbox`, `staging` and future `production-disabled`.
10. Production activation impossible through a single environment variable.

## Required first commit after repository approval

The first implementation commit must contain only the governance and benchmark foundation:

```text
AGENTS.md
README.md
config/module-registry.yaml
config/mcp-tool-registry.yaml
config/agent-identity-registry.yaml
docs/benchmarks/global-payment-switch-300.csv
docs/benchmarks/global-payment-switch-300.md
docs/architecture/mcp-agentic-payment-architecture.md
artifacts/G0_REPOSITORY_INTAKE.json
artifacts/GLOBAL_BENCHMARK_COVERAGE.json
artifacts/MCP_AGENTIC_PAYMENT_GATE.json
tests/contracts/mcp/
tests/security/mcp-abuse/
```

No live connector, real-funds endpoint, provider credential, settlement instruction or production mutation may be included.

## Decision needed

One of the following must be formally recorded:

- **Decision A — recommended:** create/expose `lanickbusiness1/afria-payswitch-sandbox-mvp` and use it as the canonical repository;
- **Decision B:** explicitly designate `lanickbusiness1/newlife` as AfrIA PaySwitch, with an ADR documenting the repurposing and impact on existing content;
- **Decision C:** expose another existing repository and provide evidence that it is the canonical AfrIA PaySwitch repository.

## Gate outcome

**G0 = FAIL-CLOSED.**

Implementation remains blocked until a canonical repository is explicitly proven. This is a governance protection, not a technical failure.
