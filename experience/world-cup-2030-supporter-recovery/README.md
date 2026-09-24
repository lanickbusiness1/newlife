# World Cup 2030 Supporter App — Recovery Artifact

## Truth state

`RECOVERY_ARTIFACT / SOURCE_NOT_RECOVERED / NON_CANONICAL / NOT_DEPLOYED`

This directory is a quarantine reconstruction created from historically described requirements after the original source could not be recovered from the currently accessible Notion, GitHub, Google Drive, or ChatGPT Library surfaces.

It is **not** the original FANOS source, **not** a catalogue product, and **not** evidence that a production app exists.

## Current authority

- Target event: World Cup 2030, per CEO correction on 24 September 2026.
- GENESIS V4.1 remains the governing execution model.
- Canonical identity is unresolved; catalogue mutation is blocked until evidence resolves Existing-Asset Match / Anti-Duplication.
- No official tournament team, qualification, schedule, ticket, or host data is hard-coded in this recovery build.
- No FIFA marks, logos, or other official tournament branding are used.

## Historical requirements retained as hypotheses

The prior conversation history described a mobile-first supporter experience with:
- onboarding and language/country preferences;
- supporter dashboard;
- match centre;
- communities;
- AI assistant/content surface;
- ticket-safety vault;
- travel/culture guidance;
- anti-scam controls;
- partial offline behavior.

These are reconstruction inputs, not proof of the original implementation.

## What this recovery slice proves

The current slice is deliberately dependency-free so that it can be checked with Node alone:
- target year is fixed to 2030;
- tournament facts remain fail-closed until sourced;
- qualification cannot be promoted without a source and verification timestamp;
- the mobile navigation shell contains the recovered functional domains;
- UI copy labels the app as an independent supporter prototype.

## Local checks

```bash
cd experience/world-cup-2030-supporter-recovery
npm test
npm run check
```

Open `index.html` in a browser for the mobile-first prototype.

## Promotion rule

Do not move this directory into `apps/`, merge it to `main`, declare `TEST_PROVEN`, or add a catalogue product until the canonical identity and upstream GENESIS V4.1 gates are reconciled.
