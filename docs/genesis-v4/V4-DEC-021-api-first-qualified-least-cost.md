# V4-DEC-021 — API-First / Qualified Least Cost™ Routing Policy

Status: ACTIVE — 2026-08-25

## Decision

When an external capability or model invocation is necessary, AfrIAgenesis® uses an API or API-compatible runtime by default and selects the least-cost route that satisfies all mandatory quality, security, sovereignty, privacy and SLA thresholds.

The objective is not the lowest nominal token price. The canonical economic metric is **cost per successful qualified task**.

## Routing order

`Capability needed → native/connected capability available? → API/runtime routes → mandatory gates → Qualified Least Cost™ → execute → measure → R.E.M.E™ optimize`

A route is admissible only when it meets the workload policy. A cheaper route MUST NOT bypass a critical quality, security, sovereignty, privacy, external-mandate or SLA requirement.

## Agentic assurance application

Independent Assurance Council™ must minimize inference cost without weakening independence or audit rigor. Local/open-source or lower-cost models may execute specialist roles when they satisfy the role threshold. Stronger models may be reserved for adversarial Red Team and Assurance Arbiter when required by measured quality.

Every Council run records provider/runtime, model, model artifact hash when available, execution contexts, snapshot SHA, evidence hashes, verdict and observed runtime economics.

## Current zero-key route

For the first internal Council, the preferred route is a pinned `llama.cpp` runtime on a GitHub Actions hosted runner using a pinned GGUF model artifact. Six independent inference requests are issued through the local OpenAI-compatible API. No model-provider API secret is required. If this route fails its quality or execution threshold, the Compute & Inference Economics Control Layer™ must escalate to the next qualified route rather than silently lowering assurance rigor.

## Execution ledger

- First live Council trigger: PR #64 / branch `feat/deploybot-sovereign-delivery-runtime`.
- Trigger commits are execution requests only; they never imply a PASS. The sealed workflow artifact and deterministic Council verifier are the authority for the verdict.
