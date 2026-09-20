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

## V4-DEC-043B — Existing Drone Product First™

The first physical consumer/demonstrator of the Distributed Manufacturing Network™ is the existing **Corridor Drone Network™ + Drone-as-a-Service** product already held under ASCISS™ / AfrIA Corridor OS™.

No new drone product, Drone Manufacturing OS, or duplicate catalogue asset is created.

The architecture is:

Corridor Drone Network™
→ Manufacturing Need / BOM
→ Design Rights
→ ManufacturingResolver™
→ REPAIR / MAKE / SOURCE / IMPORT
→ Physical ManufacturingNode
→ Machine / Printer Graph
→ Local Parts Manufacturing
→ Component Sourcing
→ Assembly
→ QA / Acceptance
→ Certification / Compliance
→ Asset Passport
→ Civil Mission Profile
→ Telemetry / Maintenance
→ R.E.M.E™

The drone remains the business product. Distributed Manufacturing Network™ remains the shared industrial capability that increases local manufacturing, repairability, availability, local content and industrial sovereignty.

Civil drone manufacturing is allowed when the intended use, design rights, regulatory requirements, human authorization and QA gates are satisfied. Weaponization, autonomous targeting and lethal autonomy remain outside the permitted scope.

## Golden Site Test™

Priority demonstrator: an existing civil drone from the catalogue.

1. Register a real physical ManufacturingNode.
2. Register at least one real machine/printer.
3. Register the authorized drone design/BOM or authorized civil component design.
4. Validate materials, machines, jurisdiction and required certifications.
5. Submit a real manufacturing need.
6. Let ManufacturingResolver™ choose REPAIR / MAKE / SOURCE / IMPORT.
7. If MAKE is selected, an authorized human approves the production/assembly job.
8. Capture real machine telemetry during production.
9. Perform assembly, post-processing and QA.
10. Complete certification/compliance checks required for the intended civil mission.
11. Issue the Asset Passport.
12. Execute a controlled civil mission or acceptance test.
13. Measure actual downtime avoided, lead-time avoided, import cost avoided and local value.
14. Record all evidence in the Evidence Ledger.

A controlled non-destructive machine interruption should force re-planning toward another ManufacturingNode or SOURCE / IMPORT.

## SITE_PROVEN exit criteria

SITE_PROVEN remains CLOSED until all of the following exist:

- at least one real instrumented microfactory/workshop;
- at least one real printer/machine integrated in read-only telemetry;
- one real authorized civil drone or civil drone component manufactured/assembled;
- documented QA/acceptance;
- required certification/compliance evidence for the intended civil use;
- human authorization of the manufacturing job;
- healthcheck and fallback/rollback evidence;
- complete Evidence Ledger;
- measured Industrial Availability Value™.

Passing CI alone is not sufficient.

Current status: TEST_PROVEN / EXISTING DRONE PRODUCT FIRST CANONICALIZED / PHYSICAL SITE-PROOF REQUIREMENTS CANONICALIZED / SITE_PROVEN CLOSED.
