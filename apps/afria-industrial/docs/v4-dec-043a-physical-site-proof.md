# V4-DEC-043A — Physical Microfactory & Site-Proof Gate

Status: CEO VALIDATED  
Parent: V4-DEC-043 — Distributed Manufacturing Network™  
Current truth ceiling: TEST_PROVEN

## Canonical rule

The Distributed Manufacturing Network™ cannot reach SITE_PROVEN from a software resolver alone.

SITE_PROVEN requires a real, instrumented ManufacturingNode: a physical microfactory or workshop with actual production equipment, materials, energy, human operators, QA and machine telemetry.

## Cyber-physical chain

Need / Failure
→ ManufacturingResolver™
→ Physical ManufacturingNode
→ Machine / Printer Availability
→ Material
→ Energy
→ Human Authorization
→ Production
→ Post-processing
→ QA / Acceptance
→ Asset Passport
→ Installation
→ Economic Evidence
→ R.E.M.E™

## Minimum physical ManufacturingNode

A site-proof node must expose:

- site identity, jurisdiction and owner;
- machines and printers;
- supported processes and materials;
- real available capacity;
- energy and connectivity state;
- calibration and maintenance state;
- operator skills and authorizations;
- production queue and job status;
- QA capability;
- cost, lead-time and evidence.

## Machine / Printer object

Minimum fields:

- machine_id
- manufacturer
- model
- process
- build_volume
- supported_materials
- firmware_version
- calibration_state
- health_state
- current_job
- queue
- estimated_availability
- maintenance_state
- energy_consumption
- material_consumption
- quality_history
- failure_history
- evidence[]

## Adapter boundary

The first field adapter is read-only / observability-first.

It may read machine state, job progress, alarms, material usage, energy, calibration and maintenance signals.

It must not expose direct machine actuation from GENESIS during the first site-proof phase.

## Golden Site Test™

Use a civil, non-critical part.

1. Register a real physical ManufacturingNode.
2. Register at least one real machine/printer.
3. Register an authorized design and material.
4. Submit a real need.
5. Let ManufacturingResolver™ choose REPAIR / MAKE / SOURCE / IMPORT.
6. If MAKE is selected, an authorized human approves the production job.
7. Capture real machine telemetry during production.
8. Perform post-processing and QA.
9. Install the part.
10. Measure actual downtime avoided, lead-time avoided, import cost avoided and local value.
11. Record all evidence in the Evidence Ledger.

A controlled non-destructive failure/interruption scenario should force re-planning toward another ManufacturingNode or SOURCE / IMPORT.

## SITE_PROVEN exit criteria

SITE_PROVEN remains CLOSED until all of the following exist:

- at least one real instrumented microfactory/workshop;
- at least one real printer/machine integrated in read-only telemetry;
- one real authorized civil part manufactured;
- documented QA/acceptance;
- human authorization of the manufacturing job;
- healthcheck and fallback/rollback evidence;
- complete Evidence Ledger;
- measured Industrial Availability Value™.

Passing CI alone is not sufficient.

Current status: TEST_PROVEN / PHYSICAL SITE-PROOF REQUIREMENTS CANONICALIZED / SITE_PROVEN CLOSED.
