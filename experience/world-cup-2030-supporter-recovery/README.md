# World Cup 2030 Supporter App — Recovery Artifact

## Truth state

`RECOVERY_ARTIFACT / SOURCE_NOT_RECOVERED / NON_CANONICAL / TEST_PROVEN_ON_BRANCH / NOT_DEPLOYED`

This directory is a quarantined reconstruction created from historically described requirements after the original source could not be recovered from the currently accessible Notion, GitHub, Google Drive, or ChatGPT Library surfaces.

It is **not** the original FANOS source, **not** a catalogue product, **not** an official FIFA app, and **not** evidence of a production deployment.

## Current authority

- Target event: World Cup 2030, per CEO correction on 24 September 2026.
- GENESIS V4.1 remains the governing execution model.
- Canonical identity is unresolved; catalogue mutation remains blocked.
- FIFA source-proven facts currently loaded: Morocco, Portugal and Spain as hosts; Argentina, Paraguay and Uruguay as centenary-match hosts; all six are automatically qualified.
- Fixtures, stadiums, ticket inventory and any other team qualification remain fail-closed until sourced.

## v0.3 implemented surfaces

- privacy-first local supporter profile: nickname + country + up to five favorite teams, with no email or phone;
- favorites are explicitly user preferences, never qualification claims;
- safe bounded offline outbox for community drafts, watch-party interest and profile sync;
- unknown or transactional offline actions are rejected;
- provenance-gated API envelope restricted to eventYear 2030 and HTTPS source metadata;
- mobile-first dashboard, host hubs, Match Center, travel, Ticket Safety Vault, settings and grounded assistant;
- PWA manifest + service worker; offline shell;
- Ticket Safety minimisation and heuristic risk scan.

## Automated evidence

```bash
npm test
npm run check
```

v0.3.0 reached TEST_PROVEN_ON_BRANCH on GitHub Actions run 36104361955: unit tests PASS and GENESIS recovery assertions PASS on head f63af88ee6e537ac16561c2f67bebffbf912999a.

## Promotion rule

Do not merge to `main`, declare production, publish official affiliation, or mutate the product catalogue until the GENESIS V4.1 upstream gates are reconciled.
