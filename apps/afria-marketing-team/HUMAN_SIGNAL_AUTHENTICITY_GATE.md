# Human Signal & Authenticity Gate™ — HSAG-1.0

**Signal:** P0 — AI Content Distribution / Trust / Revenue Risk  
**Parent asset:** `PRD-MKT-TEAM-001` — AfrIA Marketing Team™  
**Governance:** capability transverse, **aucun nouveau produit silo**  
**Status:** implemented on feature branch; merge requires CI green.

## Canonical decision

AfrIA Marketing Team™ must treat AI as production infrastructure, not as a substitute for first-party expertise. Public content should carry verifiable evidence, specific context, visible human contribution and high information density before publication.

Canonical chain:

```text
Signal
→ Research
→ Genesis Knowledge
→ AI Draft
→ Human Insight Injection
→ Evidence Check
→ Human Signal & Authenticity Gate™
→ S7+ SEND approval
→ Publication
→ Engagement
→ Lead
→ CRM
→ Deal
→ Revenue
→ R.E.M.E.
```

## Gate dimensions

HSAG-1.0 evaluates six explicit dimensions supplied by the upstream content-analysis workflow:

1. originality score;
2. evidence score;
3. specificity score;
4. human contribution score;
5. information density score;
6. generic / templated language risk.

The gate also requires a verified-evidence count and a human-review flag. The control plane is deterministic and auditable; it does not claim to reproduce LinkedIn, YouTube or Substack ranking systems.

## Decisions

- `pass`: risk-adjusted score >= 75, at least one verified evidence item, acceptable evidence/human scores, human review complete;
- `revise`: quality is useful but the risk-adjusted score or human/evidence conditions are below the pass threshold;
- `block`: no verified evidence, generic-language risk >= 75, or risk-adjusted score < 45.

A `pass` never authorizes external publication by itself. `send_allowed=false` is invariant; the existing S7+ human approval remains mandatory for `SEND`.

## API

```text
POST /content/authenticity/assess
```

The response exposes the quality score, risk-adjusted score, decision, reasons and S7+ publication boundary.

## Revenue measurement

The content KPI hierarchy is:

```text
Attributed revenue
→ qualified opportunities
→ decision-maker meetings
→ qualified conversations
→ leads
→ qualified profile visits
→ engagement
→ impressions
```

R.E.M.E. should learn which evidence types, first-party insights and content patterns correlate with qualified conversations, pipeline and collected cash rather than maximizing post volume.
