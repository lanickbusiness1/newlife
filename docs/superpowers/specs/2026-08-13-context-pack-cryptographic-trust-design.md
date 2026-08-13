# GENESIS V4 Context Pack Cryptographic Trust — Design

Date: 2026-08-13
Status: CEO-approved design
Repository: `lanickbusiness1/newlife`
Branch: `genesis-v4-continental-skill-factory`

## Objective

Upgrade `GENESIS_CONTEXT_PACK_PROVENANCE_0.1.0` from integrity-only SHA-256 provenance to issuer-authenticated provenance while keeping OIDC identity trust separate from Context Pack artifact trust.

## Decision

Use a dedicated artifact trust domain with Ed25519 verification.

- Context Pack signing authority is separate from OIDC/JWKS authentication authority.
- GENESIS verification runtime receives trusted public-key metadata only.
- Signing authority remains outside the MCP verification service.
- v0.2 supports only `Ed25519`.
- Verification is fail-closed.
- The trust lookup interface must later support filesystem, KMS/HSM or JWKS-backed providers without changing Country Compiler semantics.

## Provenance v0.2

Required fields extend v0.1:

- `provenanceVersion = GENESIS_CONTEXT_PACK_PROVENANCE_0.2.0`
- `contextPackId`
- semantic `version`
- `countryCode`
- `issuer`
- `issuedAt`
- `expiresAt`
- non-empty `sources`
- `contextSha256`
- `signatureAlgorithm = Ed25519`
- `keyId`
- `signedAt`
- `signature`

The existing STRATEX-99 SHA-256 fingerprint remains the meaning of `contextSha256`.

## Signed envelope

The signature binds every security-relevant field except `signature` itself: provenance version, pack id/version, country, issuer, issue/expiry dates, sources, context SHA, algorithm, key id and signing time.

Canonical serialization reuses the deterministic JSON rule already present in `contextPackProvenance.ts`: recursive lexicographic object-key order, stable array order and UTF-8 bytes. Alternate whitespace-dependent encodings are not accepted.

## Trust record

A trusted key record contains:

- trust format version
- issuer
- keyId
- algorithm
- public verification key
- allowed countries
- optional Context Pack family scope
- validFrom / validUntil
- status: `active`, `retired`, `revoked`
- revocation metadata when applicable
- integrity metadata for the trust record

Lookup is by `(issuer, keyId)` and must resolve to exactly one record.

## Lifecycle semantics

`active`: may verify signatures created during its valid window.

`retired`: no new signing after retirement, but historical packs signed during the authorized window may verify until their own expiry.

`revoked`: fail closed, including historical packs. Revocation means trust loss, not normal rotation, and must remain auditable/append-only.

## Verification order

1. Require provenance.
2. Validate v0.2 structure and timestamps.
3. Enforce expected country.
4. Reject expired packs.
5. Require sources.
6. Recompute and compare `contextSha256`.
7. Require supported signature algorithm.
8. Resolve exactly one trusted `(issuer, keyId)` record.
9. Reject revoked or out-of-window key use.
10. Enforce country/Context Pack scope.
11. Require `signedAt <= now`.
12. Verify Ed25519 signature over the canonical signed envelope.
13. Return normalized verified provenance.

All trust/signature failures block compilation; they never become `alert_ready`.

## Components

### `contextPackTrustStore.ts`

Provider-neutral lookup and lifecycle validation for trusted public-key records, including scope and append-only revocation semantics.

### `contextPackSignature.ts`

Canonical signed-envelope construction and Ed25519 verification using Node crypto. Production runtime contains no signing path; signing helpers are allowed only in tests/fixtures.

### `contextPackProvenance.ts`

Preserves existing SHA-256 integrity checks and delegates trust/signature validation before returning verified provenance.

### Country Compiler

No successful territorial compilation without v0.2 verification. Output lineage includes pack id, provenance version, issuer, keyId, context SHA and verification status.

### MCP boundary

`genome.country_compiler.compile` structurally requires all v0.2 signature fields. Clients cannot omit them and rely on downstream defaults.

## Stable fail-closed errors

Initial families:

- `CONTEXT_PACK_SIGNATURE_REQUIRED`
- `CONTEXT_PACK_SIGNATURE_ALGORITHM_UNSUPPORTED`
- `CONTEXT_PACK_TRUST_KEY_NOT_FOUND`
- `CONTEXT_PACK_TRUST_KEY_AMBIGUOUS`
- `CONTEXT_PACK_TRUST_KEY_REVOKED`
- `CONTEXT_PACK_TRUST_KEY_NOT_YET_VALID`
- `CONTEXT_PACK_TRUST_KEY_EXPIRED`
- `CONTEXT_PACK_TRUST_SCOPE_DENIED`
- `CONTEXT_PACK_SIGNATURE_INVALID`

Existing country, expiry, source and integrity errors remain authoritative when encountered earlier.

## TDD acceptance matrix

RED tests must cover at least:

1. valid signed GN pack succeeds;
2. missing signature fails;
3. modified STRATEX-99 context fails;
4. modified source metadata fails even with unchanged context SHA;
5. country tampering fails;
6. unknown issuer/key fails;
7. ambiguous duplicate issuer/key fails;
8. wrong public key fails;
9. revoked key fails;
10. retired key accepts only historical signature times inside the authorized window;
11. country scope violation fails;
12. unsupported algorithm fails;
13. expired pack fails;
14. MCP schema rejects incomplete provenance;
15. Country Compiler output carries cryptographic lineage;
16. OIDC tests remain unchanged, proving separation of trust domains;
17. host smoke passes with trusted fixture key;
18. Docker smoke passes with trusted fixture key.

Adversarial tests mutate one signed field at a time to prove complete envelope binding.

## Administration boundary

v0.2 does not add public MCP tools for trust-key administration. Initial trust administration remains deployment/configuration controlled. Governed register/retire/revoke tools are deferred until authorization, audit, multi-instance coordination and operational ownership are specified.

## Migration

v0.1 packs remain historical staging artifacts. Once v0.2 is activated for governed territorial compilation, v0.1 cannot silently bypass the cryptographic gate. Migration requires external re-issuance of a v0.2 signed envelope; GENESIS must not self-sign the migration.

## Production boundary

A green implementation may claim cryptographic verification, not sovereign production trust. Production remains blocked until institutional issuer/key ceremony, controlled external signer, durable trust storage, backup/restore, rotation/revocation drill, monitoring, multi-instance consistency, jurisdictional ownership and security review are proven.

## Success criteria

- Recomputing SHA-256 alone cannot make a forged Context Pack acceptable.
- Issuer authenticity is verified against a separate artifact trust domain.
- OIDC and artifact-signing trust remain independent.
- Rotation preserves valid historical packs; revocation fails closed.
- Country/family scope is enforced.
- MCP and Country Compiler cannot bypass verification.
- Provider abstraction permits future KMS/HSM/JWKS trust backends without changing compiler semantics.
