import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const GENESIS_PERSISTENCE_COORDINATOR_VERSION = "GENESIS_PERSISTENCE_COORDINATOR_0.1.0" as const;

export interface ActiveMutation {
  mutationId: string;
  label: string;
  pid: number;
  startedAt: string;
}

interface GateLease {
  release: () => Promise<void>;
}

export class PersistenceCoordinator {
  readonly rootDir: string;

  constructor(
    rootDir = process.env.PERSISTENCE_COORDINATION_DIR ?? path.resolve(process.cwd(), ".persistence-coordination")
  ) {
    this.rootDir = path.resolve(rootDir);
  }

  private gatePath(): string {
    return path.join(this.rootDir, "gate.lock");
  }

  private snapshotPath(): string {
    return path.join(this.rootDir, "snapshot.lock");
  }

  private mutationsDir(): string {
    return path.join(this.rootDir, "mutations");
  }

  private mutationPath(mutationId: string): string {
    return path.join(this.mutationsDir(), `${mutationId}.lock`);
  }

  private async acquireGate(): Promise<GateLease> {
    await mkdir(this.rootDir, { recursive: true });
    const gate = this.gatePath();
    try {
      await mkdir(gate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error("PERSISTENCE_COORDINATION_BUSY");
      }
      throw error;
    }
    return {
      release: async () => rm(gate, { recursive: true, force: true })
    };
  }

  private async snapshotActive(): Promise<boolean> {
    try {
      await readdir(this.snapshotPath());
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async activeMutations(): Promise<ActiveMutation[]> {
    let entries;
    try {
      entries = await readdir(this.mutationsDir(), { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const active: ActiveMutation[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith(".lock")) continue;
      const mutationId = entry.name.slice(0, -5);
      try {
        const raw = await readFile(path.join(this.mutationPath(mutationId), "metadata.json"), "utf8");
        const parsed = JSON.parse(raw) as ActiveMutation;
        if (
          parsed.mutationId === mutationId &&
          typeof parsed.label === "string" &&
          typeof parsed.pid === "number" &&
          typeof parsed.startedAt === "string"
        ) {
          active.push(parsed);
        }
      } catch {
        active.push({
          mutationId,
          label: "unknown",
          pid: -1,
          startedAt: "unknown"
        });
      }
    }
    return active.sort((left, right) => left.mutationId.localeCompare(right.mutationId));
  }

  async withMutation<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const normalizedLabel = label.trim();
    if (normalizedLabel.length < 3) throw new Error("PERSISTENCE_MUTATION_LABEL_REQUIRED");

    const gate = await this.acquireGate();
    const mutationId = randomUUID();
    const mutation = this.mutationPath(mutationId);
    try {
      if (await this.snapshotActive()) {
        throw new Error("PERSISTENCE_SNAPSHOT_ACTIVE");
      }
      await mkdir(this.mutationsDir(), { recursive: true });
      await mkdir(mutation);
      const metadata: ActiveMutation = {
        mutationId,
        label: normalizedLabel,
        pid: process.pid,
        startedAt: new Date().toISOString()
      };
      await writeFile(path.join(mutation, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    } finally {
      await gate.release();
    }

    try {
      return await operation();
    } finally {
      await rm(mutation, { recursive: true, force: true });
    }
  }

  async withSnapshot<T>(operation: () => Promise<T>): Promise<T> {
    const gate = await this.acquireGate();
    const snapshot = this.snapshotPath();
    try {
      if (await this.snapshotActive()) {
        throw new Error("PERSISTENCE_SNAPSHOT_ACTIVE");
      }
      if ((await this.activeMutations()).length > 0) {
        throw new Error("PERSISTENCE_MUTATION_ACTIVE");
      }
      await mkdir(snapshot);
      await writeFile(
        path.join(snapshot, "metadata.json"),
        `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
        "utf8"
      );
    } finally {
      await gate.release();
    }

    try {
      return await operation();
    } finally {
      await rm(snapshot, { recursive: true, force: true });
    }
  }
}
