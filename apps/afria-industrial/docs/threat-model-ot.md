# OT Threat Model — S7+ proof scope

Protected assets: industrial metadata, telemetry, operator decisions, readiness evidence, API credentials, sync envelopes, evidence-chain integrity and local edge availability.

| Threat | v1 mitigation | Residual production requirement |
|---|---|---|
| API-key theft/abuse | Environment-only secrets, constant-time comparison, RBAC, proof rate limit, no secrets in responses/evidence | Enterprise identity, rotation, revocation |
| Telemetry spoofing | Source allowlist, provenance ID, data-quality flag, bounded batch, immutable receipt timestamp | Mutual authentication, certificates, site PKI |
| Replay/duplicate | Batch/point idempotency | Device/session anti-replay |
| Stale data shown live | `STALE` is not live; freshness metric; explicit UI state | Commissioned thresholds |
| Clock skew | Event and receipt times retained; suspicious future timestamps `SUSPECT` | NTP/PTP monitoring |
| Compromised edge host | Least privilege design, local bind default, evidence verification | OS hardening, encryption, secure boot, EDR, physical controls |
| Evidence tampering | Append-only API surface, SHA-256 chain, readiness fails on invalid chain | Optional external immutable anchoring/signing |
| Adapter compromise | Read-only vendor-neutral contract | Library review, cert policy, network allowlists |
| Data exfiltration | Sync envelope includes destination/purpose/class/retention/authority/encryption | DPA/DPIA and site classification |
| Unsafe actuation | No write/command/actuation method or route | New safety-critical ADR and interlocks required |

Production should segment IT/OT with explicit zones/conduits, deny unsolicited inbound access, allowlist upstream destinations and use site-approved TLS/admin paths. This proof does not claim IEC 62443 certification.
