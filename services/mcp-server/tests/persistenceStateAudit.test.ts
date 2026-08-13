import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { auditPersistenceState } from "../src/persistenceStateAudit";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function root(prefix: string) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

async function touchOld(target: string, ageMs: number) {
  const when = new Date(Date.now() - ageMs);
  await utimes(target, when, when);
}

describe("GENESIS persistence state audit", () => {
  test("reports a clean state when no locks are present", async () => {
    const stateRoot = await root("genesis-state-audit-");
    const approvalRoot = await root("genesis-approval-audit-");

    const report = await auditPersistenceState({ stateRoot, approvalRoot, staleAfterMs: 60_000 });

    expect(report.status).toBe("clean");
    expect(report.locks).toEqual([]);
    expect(report.staleCandidates).toBe(0);
    expect(report.malformed).toBe(0);
  });

  test("classifies fresh coordinator snapshot and mutation markers as active", async () => {
    const stateRoot = await root("genesis-state-audit-");
    const approvalRoot = await root("genesis-approval-audit-");
    await mkdir(path.join(stateRoot, "snapshot.lock"), { recursive: true });
    await writeFile(
      path.join(stateRoot, "snapshot.lock", "metadata.json"),
      JSON.stringify({ pid: 123, startedAt: new Date().toISOString() }),
      "utf8"
    );
    const mutation = path.join(stateRoot, "mutations", "11111111-1111-4111-8111-111111111111.lock");
    await mkdir(mutation, { recursive: true });
    await writeFile(
      path.join(mutation, "metadata.json"),
      JSON.stringify({
        mutationId: "11111111-1111-4111-8111-111111111111",
        label: "skill-install",
        pid: 123,
        startedAt: new Date().toISOString()
      }),
      "utf8"
    );

    const report = await auditPersistenceState({ stateRoot, approvalRoot, staleAfterMs: 60_000 });

    expect(report.status).toBe("busy");
    expect(report.locks.map(lock => lock.classification)).toEqual(["active", "active"]);
    expect(report.active).toBe(2);
  });

  test("classifies old coordinator markers as stale candidates without deleting them", async () => {
    const stateRoot = await root("genesis-state-audit-");
    const approvalRoot = await root("genesis-approval-audit-");
    const snapshot = path.join(stateRoot, "snapshot.lock");
    await mkdir(snapshot, { recursive: true });
    await writeFile(
      path.join(snapshot, "metadata.json"),
      JSON.stringify({ pid: 123, startedAt: new Date(Date.now() - 120_000).toISOString() }),
      "utf8"
    );
    await touchOld(snapshot, 120_000);

    const report = await auditPersistenceState({ stateRoot, approvalRoot, staleAfterMs: 60_000 });

    expect(report.status).toBe("attention_required");
    expect(report.staleCandidates).toBe(1);
    expect(report.locks[0]).toMatchObject({
      subsystem: "persistence",
      kind: "snapshot",
      classification: "stale_candidate"
    });
    expect(report.locks[0]?.recommendedAction).toMatch(/manual_recovery_required/);
  });

  test("approval locks are visible even though they contain no metadata", async () => {
    const stateRoot = await root("genesis-state-audit-");
    const approvalRoot = await root("genesis-approval-audit-");
    const approvalId = "06d8d70b-f038-4272-858c-f60a78263e13";
    const lock = path.join(approvalRoot, "locks", `${approvalId}.lock`);
    await mkdir(lock, { recursive: true });

    const report = await auditPersistenceState({ stateRoot, approvalRoot, staleAfterMs: 60_000 });

    expect(report.status).toBe("busy");
    expect(report.locks[0]).toMatchObject({
      subsystem: "approval",
      kind: "approval_operation",
      approvalId,
      classification: "active"
    });
  });

  test("old approval lock becomes a stale candidate but is never auto-recovered", async () => {
    const stateRoot = await root("genesis-state-audit-");
    const approvalRoot = await root("genesis-approval-audit-");
    const approvalId = "16d8d70b-f038-4272-858c-f60a78263e13";
    const lock = path.join(approvalRoot, "locks", `${approvalId}.lock`);
    await mkdir(lock, { recursive: true });
    await touchOld(lock, 120_000);

    const report = await auditPersistenceState({ stateRoot, approvalRoot, staleAfterMs: 60_000 });

    expect(report.status).toBe("attention_required");
    expect(report.locks[0]).toMatchObject({
      approvalId,
      classification: "stale_candidate",
      autoRecoverable: false
    });
  });

  test("malformed coordinator metadata is treated as attention-required, never as stale proof", async () => {
    const stateRoot = await root("genesis-state-audit-");
    const approvalRoot = await root("genesis-approval-audit-");
    const mutation = path.join(stateRoot, "mutations", "bad.lock");
    await mkdir(mutation, { recursive: true });
    await writeFile(path.join(mutation, "metadata.json"), "{not-json", "utf8");

    const report = await auditPersistenceState({ stateRoot, approvalRoot, staleAfterMs: 1 });

    expect(report.status).toBe("attention_required");
    expect(report.malformed).toBe(1);
    expect(report.locks[0]?.classification).toBe("malformed");
    expect(report.locks[0]?.autoRecoverable).toBe(false);
  });

  test("rejects unsafe stale thresholds", async () => {
    const stateRoot = await root("genesis-state-audit-");
    const approvalRoot = await root("genesis-approval-audit-");

    await expect(auditPersistenceState({ stateRoot, approvalRoot, staleAfterMs: 0 }))
      .rejects.toThrow(/PERSISTENCE_AUDIT_STALE_THRESHOLD_INVALID/);
  });
});
