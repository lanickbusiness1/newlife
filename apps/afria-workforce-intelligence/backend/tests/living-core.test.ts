import assert from "node:assert/strict";
import test from "node:test";
import { Employee, Identity, Tenant } from "../src/domain.js";
import { ControlError, InMemoryEvidenceVault, WorkforceLivingCore } from "../src/living-core.js";

const tenant = new Tenant("tenant-a", "tenant-a", "AfrIA Demo", "BJ");
const employee = new Employee("emp-1", tenant.id, "id-employee", "AWI-001");

test("activates an employee only with human HR approval and creates proof of life", () => {
  const vault = new InMemoryEvidenceVault();
  const core = new WorkforceLivingCore(vault);
  const approver = new Identity("id-hr", tenant.id, "HUMAN", "HR Director", ["HR_APPROVER"]);

  const activated = core.activateEmployee({ tenant, actor: approver, employee });

  assert.equal(activated.state, "ACTIVE");
  assert.equal(activated.version, 2);
  assert.equal(activated.evidence.length, 1);
  assert.equal(core.eventStream()[0]?.type, "EmployeeActivated");
  assert.deepEqual(core.missionControlSnapshot(), { events: 1, evidence: 1, status: "HEALTHY" });
});

test("blocks an agent from approving a sensitive HR activation", () => {
  const core = new WorkforceLivingCore(new InMemoryEvidenceVault());
  const agent = new Identity("agent-hr", tenant.id, "AGENT", "HR Operations Agent", ["HR_APPROVER"]);

  assert.throws(
    () => core.activateEmployee({ tenant, actor: agent, employee }),
    (error: unknown) => error instanceof ControlError && /human actor/.test(error.message),
  );
});

test("blocks cross-tenant access", () => {
  const core = new WorkforceLivingCore(new InMemoryEvidenceVault());
  const foreignApprover = new Identity("id-foreign", "tenant-b", "HUMAN", "Foreign HR", ["HR_APPROVER"]);

  assert.throws(
    () => core.activateEmployee({ tenant, actor: foreignApprover, employee }),
    (error: unknown) => error instanceof ControlError && /Tenant isolation/.test(error.message),
  );
});
