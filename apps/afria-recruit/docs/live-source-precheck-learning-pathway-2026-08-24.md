# AfrIA Recruit™ — Verified Learning & Credential Intelligence Engine™

## Live Source Precheck — 24 August 2026

**Canonical asset:** `PRD-RECRUIT-001`  
**Capability:** Verified Learning & Credential Intelligence Engine™  
**Control added:** Learning Pathway Eligibility Guard™  
**Status:** `LIVE SOURCE PRECHECK + GAP-SEMANTICS TEST_PROVEN`  
**Release status:** `HOLD REAL-DATA E2E / S7+ / M8 / PRODUCTION`

This document records a controlled comparison of a current public job, primary learning sources, and an authorized private candidate evidence set. No raw CV, name, email, phone, address, birth data, reference contact, or other candidate PII is stored in this public repository. Only de-identified eligibility conclusions are retained.

## 1. Current public target job

**CICR / ICRC — Gestionnaire de la Chaîne d’Approvisionnement 1 — Tombouctou, Mali**  
Public source: https://anpe-mali.org/poste/le-comite-international-de-la-croix-rouge-cicr-tombouctou-5-une-gestionnaire-de-la-chaine-dapprovisionnement-1/  
Public deadline observed: **2026-09-03**.

Material requirements extracted from the public notice include:

- technical diploma in logistics, administration or equivalent;
- at least two years of professional logistics experience;
- French and English;
- Microsoft Office familiarity;
- ERP knowledge as an asset;
- **mastery of ICRC logistics procedures**;
- JDE-IRIS knowledge as an asset.

The distinction between **mandatory requirement** and **asset** is preserved. An asset must not silently become a hard rejection gate.

## 2. Primary learning sources checked

### A. Mercy Corps × DisasterReady — Procurement & Logistics Certificate

Primary source: https://fr.disasterready.org/procurement-logistics-certificate

Observed contract:

- free learning;
- free certificate;
- assessment based;
- approximately five hours;
- French / English / Spanish / Arabic;
- procurement, warehousing, inventory, fleet and asset-management content.

Classification: `FREE_CERTIFIED`.

### B. UNICEF Agora — La logistique à l’UNICEF

Primary source: https://agora.unicef.org/c/La%2Blogistique%2B%25C3%25A0%2Bl%25E2%2580%2599UNICEF

Observed contract:

- French version available;
- approximately five hours;
- international and in-country transport, warehousing and inventory;
- final assessment required for certificate;
- external partners may self-enrol.

The course teaches logistics **in the UNICEF operating context**. It is not evidence of mastery of ICRC-specific procedures.

### C. UNICEF Agora — Cold Chain Logistics & Vaccine Management

Primary source: https://agora.unicef.org/course/info.php?id=11071

Observed contract:

- specialized health / immunization cold-chain pathway;
- open self-enrolment;
- final assessment;
- certificate available after successful completion.

For a general ICRC supply-chain role, this is a specialized pathway and must not be promoted merely because some logistics vocabulary overlaps.

### D. edX audit track — control vector for misleading “free certification” claims

Primary source: https://support.edx.org/hc/en-us/articles/1500003964681-What-is-the-audit-track

Observed rule: the audit track can provide free learning access, but **does not provide a certificate**. A verified certificate requires upgrade to the verified track when available.

Canonical classification for such a course configuration: `FREE_LEARNING_PAID_CREDENTIAL`, never `FREE_CERTIFIED`.

## 3. Private candidate evidence boundary

An authorized private CV was used only to determine coverage classes. The raw document and its personal data were not copied into GitHub and were not injected into production Supabase.

The precheck showed the central product issue:

> A senior profile can already evidence broad humanitarian logistics capability while still having a mandatory eligibility requirement that a generic logistics certificate cannot close.

For the target job, the material unresolved dimensions include:

- `procedure` — ICRC-specific logistics procedures: required and not closable by a generic Mercy Corps/DisasterReady or UNICEF logistics certificate;
- `education` — equivalence against the stated technical logistics/administration diploma requirement requires evidence-backed or human review;
- `software` — ERP and JDE-IRIS are useful signals, but the public notice describes them as assets rather than universal hard gates.

## 4. Product defect exposed by real-source comparison

The M6 Core context originally represented only:

`skillGaps: string[]`

That contract was insufficient for real eligibility because job barriers are not all skills. They can be:

`skill | language | education | experience | procedure | software | credential | license | other`

Without this distinction, a useful course could be misrepresented as making the candidate eligible even while a mandatory non-skill requirement remained unresolved.

## 5. Learning Pathway Eligibility Guard™

The guard now applies the following invariant:

1. a course closing no target skill gap cannot be presented as an eligibility-closing recommendation;
2. if the course closes a real skill gap but a mandatory non-skill gap remains, the pathway is held at `REVIEW`;
3. the useful course score may be preserved under `REVIEW`, but it is not converted to `PASS`;
4. each unresolved mandatory requirement travels with an explicit reason:
   `OUTSTANDING_REQUIRED_GAP:<kind>:<id>`;
5. optional assets do not automatically become hard blockers;
6. human or source-backed resolution remains required for education equivalence and organization-specific prerequisites.

## 6. TDD evidence

### RED

Commit: `12ee8818f9fe66382881be47023e28392fa9666c`  
GitHub Actions: run `#199` / `32787422670` — **FAILURE expected**.

Exact cause: TypeScript rejected `gaps` because `CandidateLearningContext` could only represent `skillGaps`. Dependency installation and dependency audit had already passed before the unit-test compile stopped.

### GREEN

Implementation commit: `f177aa56cf1e3e6771cadb216b5400c6b467e504`  
GitHub Actions: run `#201` / `32787634599` — **SUCCESS**.

Observed gates:

- dependency audit: PASS / zero vulnerabilities at configured level;
- unit tests: **86/86 PASS**;
- new typed-gap tests: **2/2 PASS**;
- TypeScript typecheck: PASS;
- Next.js production build: PASS;
- Playwright browser proof: **8/8 PASS**;
- source security scan: PASS;
- public bundle scan: PASS.

## 7. Live-precheck verdict

The verified public learning sources are useful, but none of the generic logistics courses checked establishes mastery of **ICRC-specific logistics procedures**. Therefore the system must not claim that these courses alone close the target job’s full eligibility gap.

Correct product outcome:

`Generic logistics already covered → organization-specific required procedure unresolved → learning enrichment may be useful → ELIGIBILITY remains REVIEW/HOLD → no fabricated PASS`.

This is the intended fail-closed behavior.

## 8. Remaining boundary

This precheck is deliberately **not** called a production-data E2E test. The next evidence gate remains:

`authorized candidate record + sourced live job record + sourced learning records → producer contracts → Supabase/RLS path → typed eligibility gaps → pathway evaluation → Talent Passport vNext simulation → readiness delta → audit evidence`.

Only after that path is proven may the capability advance toward `S7+ → M8 → external review → Release-to-Revenue`.
