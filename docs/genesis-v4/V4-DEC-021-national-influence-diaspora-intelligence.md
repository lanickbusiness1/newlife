# V4-DEC-021 — National Influence & Diaspora Intelligence Engine™

**Date:** 2026-08-25  
**Status:** CANONICAL DECISION — SPECIFIED, NOT YET IMPLEMENTED  
**Priority:** P0  
**Country:** Benin  
**Parent asset:** AfrIAgenesis — Observatoire Benin Soft Power  
**Governance:** GENESIS V4 / R.E.M.E™ / Release-to-Revenue Control Plane™

## External signal

Government of Benin publication: `66 VISAGES, 66 PARCOURS QUI FONT LA FIERTE DU BENIN`.

Source: https://x.com/gouvbenin/status/2091647593465991219

Signal classification: **P0 — COUNTRY BRAND / DIASPORA / INFLUENCE INTELLIGENCE**.

## Canonical decision

1. Do not create a standalone product from the `66 Visages` campaign.
2. Do not use `BENIN INFLUENCE` as an AfrIAgenesis proprietary product name or imply ownership, mandate or institutional affiliation.
3. Attach this signal to the existing **AfrIAgenesis — Observatoire Benin Soft Power** asset.
4. Add a transverse capability named **National Influence & Diaspora Intelligence Engine™**.
5. Preserve synergies with CEA Consulting, Retour aux Sources™ and Pack Diaspora & Investissement.

## Mission

Convert public national-influence signals into a governed, traceable and commercially actionable graph:

`Person -> Sector -> Country -> Company/Institution -> Expertise -> Network -> Audience -> Projects -> Investment -> Tourism -> Partnership -> Measured Impact`

## Core graphs

- Influence Graph
- Diaspora Graph
- Opportunity Graph
- Expertise & Talent Graph
- Partner / Institution Graph
- Activation & Conversion Graph

## Canonical flow

`Public Signal -> Provenance -> Verification -> Deduplication -> Entity Resolution -> Influence Graph -> Diaspora Graph -> Opportunity Graph -> Qualification -> CRM / Partner Activation -> Tourism / Expertise / Investment / Partnerships -> Evidence -> Measurement -> R.E.M.E™`

## Data governance

External campaigns, portraits, trademarks and editorial assets remain owned by their respective rights holders. AfrIAgenesis must not copy or republish protected campaign assets as proprietary content.

The engine must maintain at minimum:

- source provenance;
- source URL and capture date;
- entity resolution and deduplication;
- confidence / verification status;
- rights and reuse metadata where applicable;
- audit trail;
- data-boundary controls;
- human approval gates for sensitive or institutional claims;
- correction and deletion workflows.

## Sellable outputs

The capability may power, without creating a new silo product:

- Government Country Brand Cockpit;
- Diaspora CRM & Investment Funnel;
- Talent & Expertise Graph;
- Ambassador / Influence Activation Cockpit;
- diaspora expertise search API;
- country-brand reach, conversion and economic-contribution dashboards.

## Commercial objective

Move from visibility to measurable national value:

`Influence -> Qualified Relationship -> Activation -> Project / Visit / Expertise / Investment -> Evidence -> Economic or Institutional Outcome`

## Architecture constraint

This capability is an extension of an existing canonical asset. Any implementation must pass the mandatory AfrIAgenesis chain and controls, including M6, S7+, M8, security and data governance, human approval gates, rollback, audit evidence and Genesis Release-to-Revenue Control Plane™.

## Implementation status

This ADR anchors the decision only. It does **not** claim that the engine, ingestion pipelines, knowledge graph, APIs, CRM connectors or dashboards are already implemented or deployed.

Implementation DONE requires at least:

1. canonical schemas and migrations;
2. source/provenance registry;
3. ingestion and entity-resolution pipeline;
4. influence/diaspora/opportunity graph services;
5. scoring and verification rules;
6. API and cockpit;
7. permissions, audit and data-boundary tests;
8. automated test suite;
9. M6 and S7+ evidence;
10. M8 go/no-go review;
11. deploy + rollback proof;
12. Release Center record and R.E.M.E™ feedback loop.
