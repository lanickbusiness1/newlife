# GENESIS V4 Context Pack Cryptographic Trust — Design

Date: 2026-08-13
Status: CEO-approved design
Repository: `lanickbusiness1/newlife`
Branch: `genesis-v4-continental-skill-factory`

## Objective

Upgrade `GENESIS_CONTEXT_PACK_PROVENANCE_0.1.0` from SHA-256 integrity provenance to issuer-authenticated provenance, while keeping OIDC identity trust separate from Context Pack artifact trust.

## Decision

Use a dedicated artifact trust domain with Ed25519 verification.

- OIDC/JWKS keys authenticate principals; Context Pack keys authenticate artifacts.
- GENESIS verification runtime holds trusted public verification material only.
- Signing authority stays outside the MCP verification service.
- v0.2 supports only `Ed25519` and fails closed.
- Trust lookup is provider-neutral so storage can later move to KMS/HSM/JWKS without changing Country Compiler semantics.

## Provenance v0.2

Required fields: `provenanceVersion`, `contextPackId`, semantic `version`, `countryCode`, `issuer`, `issuedAt`, `expiresAt`, non-empty `sources`, `contextSha256`, `signatureAlgorithm=Ed25519`, `keyId`, `signedAt`, `signature`.

`contextSha256` keeps the existing deterministic STRATEX-99 fingerprint semantics.

## Signed envelope

The signature covers every security-relevant provenance field except `signature` itself. Canonical serialization reuses the deterministic JSON rule already implemented in `contextPackProvenance.ts`: recursively sorted object keys, stable array order, UTF-8 bytes.

## Trust record

Each trusted record contains: trust version, issuer, keyId, algorithm, public verification material, allowed countries, optional Context Pack family scope, `validFrom`, `validUntil`, lifecycle status (`active`, `retired`, `revoked`), `retiredAt` when retired, `revokedAt` plus reason when revoked, and integrity metadata.

Lookup is by `(issuer, keyId)` and must resolve to exactly one record.

## Lifecycle

- `active`: signatures are valid only when `signedAt` is inside `validFrom..validUntil`.
- `retired`: no new signing at or after `retiredAt`; historical packs with `signedAt < retiredAt` and inside the validity window may verify until pack expiry.
- `revoked`: fail closed for current and historical packs.
- `retired` without valid `retiredAt`, or `revoked` without valid `revokedAt`, is invalid trust metadata and fails closed.

Retirement models normal rotation; revocation models loss of trust and remains auditable/append-only.

## Verification order

1. Require v0.2 provenance and valid timestamps.
2. Enforce expected country and pack expiry.
3. Require sources and validate `contextSha256`.
4. Require supported algorithm.
5. Resolve exactly one trusted `(issuer,keyId)` record.
6. Validate lifecycle metadata; reject revoked keys.
7. Require `signedAt` inside key validity; for retired keys also require `signedAt < retiredAt`.
8. Enforce country/Context Pack family scope and `signedAt <= now`.
9. Verify Ed25519 signature over the canonical envelope.
10. Return normalized verified provenance.

Trust/signature failures always block compilation; they never become `alert_ready`.

## Components

- `contextPackTrustStore.ts`: provider-neutral trusted-record lookup, scope and lifecycle validation, append-only revocation semantics.
- `contextPackSignature.ts`: canonical envelope and Ed25519 verification using Node crypto; signing helper allowed only in tests/fixtures.
- `contextPackProvenance.ts`: preserves SHA-256 checks and delegates cryptographic trust verification.
- Country Compiler: no territorial success without v0.2 verification; lineage includes pack id, provenance version, issuer, keyId, context SHA and verification status.
- MCP: `genome.country_compiler.compile` structurally requires v0.2 signature fields.

## Stable fail-closed errors

`CONTEXT_PACK_SIGNATURE_REQUIRED`, `CONTEXT_PACK_SIGNATURE_ALGORITHM_UNSUPPORTED`, `CONTEXT_PACK_TRUST_KEY_NOT_FOUND`, `CONTEXT_PACK_TRUST_KEY_AMBIGUOUS`, `CONTEXT_PACK_TRUST_KEY_REVOKED`, `CONTEXT_PACK_TRUST_KEY_NOT_YET_VALID`, `CONTEXT_PACK_TRUST_KEY_EXPIRED`, `CONTEXT_PACK_TRUST_KEY_INVALID`, `CONTEXT_PACK_TRUST_SCOPE_DENIED`, `CONTEXT_PACK_SIGNATURE_INVALID`.

Existing country, expiry, source and integrity errors retain precedence when encountered earlier.

## TDD acceptance matrix

RED tests must cover: valid signed pack; missing signature; mutated STRATEX-99 context; mutated source metadata; country tampering; unknown and ambiguous issuer/key; wrong public key; revoked key; retired-key time boundary; malformed lifecycle metadata; country-scope denial; unsupported algorithm; expired pack; incomplete MCP provenance; Country Compiler cryptographic lineage; unchanged OIDC tests; host smoke; Docker smoke.

Adversarial tests mutate one signed field at a time to prove full-envelope binding.

## Administration and migration boundary

v0.2 adds no public MCP trust-administration tools. Trust administration remains deployment/configuration controlled until authorization, audit and multi-instance ownership are specified.

v0.1 packs remain historical staging artifacts. Once v0.2 gate is active, v0.1 cannot silently pass it. Migration requires external re-issuance of a signed v0.2 envelope; GENESIS does not self-sign migrations.

## Production boundary

A green increment may claim cryptographic verification, not sovereign production trust. Production remains blocked until institutional issuer/key ceremony, controlled external signer, durable trust storage, backup/restore, rotation/revocation drill, monitoring, multi-instance consistency, jurisdictional ownership and security review are proven.

## Success criteria

Recomputing SHA-256 alone cannot forge trust; issuer authenticity is independently verified; OIDC and artifact trust stay separated; normal rotation preserves eligible historical packs while revocation fails closed; territorial scope is enforced; MCP/Country Compiler cannot bypass verification; provider abstraction remains portable.
