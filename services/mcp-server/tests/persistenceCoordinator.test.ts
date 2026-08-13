import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { PersistenceCoordinator } from "../src/persistenceCoordinator";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function coordinator() {
  const root = await mkdtemp(path.join(tmpdir(), "genesis-persistence-coordination-"));
  roots.push(root);
  return new PersistenceCoordinator(root);
}

describe("GENESIS persistence coordination", () => {
  test("a snapshot cannot start while a mutation is active", async () => {
    const c = await coordinator();
    let releaseMutation!: () => void;
    const hold = new Promise<void>(resolve => { releaseMutation = resolve; });
    let mutationEntered!: () => void;
    const entered = new Promise<void>(resolve => { mutationEntered = resolve; });

    const mutation = c.withMutation("registry-install", async () => {
      mutationEntered();
      await hold;
      return "mutated";
    });
    await entered;

    await expect(c.withSnapshot(async () => "snapshot"))
      .rejects.toThrow(/PERSISTENCE_MUTATION_ACTIVE/);

    releaseMutation();
    await expect(mutation).resolves.toBe("mutated");
    await expect(c.withSnapshot(async () => "snapshot")).resolves.toBe("snapshot");
  });

  test("a mutation cannot start while a snapshot is active", async () => {
    const c = await coordinator();
    let releaseSnapshot!: () => void;
    const hold = new Promise<void>(resolve => { releaseSnapshot = resolve; });
    let snapshotEntered!: () => void;
    const entered = new Promise<void>(resolve => { snapshotEntered = resolve; });

    const snapshot = c.withSnapshot(async () => {
      snapshotEntered();
      await hold;
      return "snapshot";
    });
    await entered;

    await expect(c.withMutation("approval-revoke", async () => "mutation"))
      .rejects.toThrow(/PERSISTENCE_SNAPSHOT_ACTIVE/);

    releaseSnapshot();
    await expect(snapshot).resolves.toBe("snapshot");
  });

  test("multiple mutations may coexist but snapshot waits fail-closed", async () => {
    const c = await coordinator();
    let release!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    let firstEntered!: () => void;
    let secondEntered!: () => void;
    const firstReady = new Promise<void>(resolve => { firstEntered = resolve; });
    const secondReady = new Promise<void>(resolve => { secondEntered = resolve; });

    const first = c.withMutation("registry-install", async () => {
      firstEntered();
      await hold;
      return "first";
    });
    const second = c.withMutation("approval-attest", async () => {
      secondEntered();
      await hold;
      return "second";
    });
    await Promise.all([firstReady, secondReady]);

    expect((await c.activeMutations()).length).toBe(2);
    await expect(c.withSnapshot(async () => "snapshot"))
      .rejects.toThrow(/PERSISTENCE_MUTATION_ACTIVE/);

    release();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(await c.activeMutations()).toEqual([]);
  });

  test("snapshot is exclusive against another snapshot", async () => {
    const c = await coordinator();
    let release!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });

    const first = c.withSnapshot(async () => {
      entered();
      await hold;
      return "first";
    });
    await ready;

    await expect(c.withSnapshot(async () => "second"))
      .rejects.toThrow(/PERSISTENCE_SNAPSHOT_ACTIVE/);

    release();
    await expect(first).resolves.toBe("first");
  });

  test("gate and operation locks are released after callback failure", async () => {
    const c = await coordinator();

    await expect(c.withMutation("registry-install", async () => {
      throw new Error("simulated failure");
    })).rejects.toThrow(/simulated failure/);

    expect(await c.activeMutations()).toEqual([]);
    await expect(c.withSnapshot(async () => "healthy")).resolves.toBe("healthy");
  });
});
