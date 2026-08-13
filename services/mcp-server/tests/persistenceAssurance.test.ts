import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  createVerifiedBackup,
  restoreVerifiedBackup,
  verifyBackup
} from "../src/persistenceAssurance";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function root(prefix: string) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

async function seed(source: string) {
  await mkdir(path.join(source, "registry", "skill-a"), { recursive: true });
  await mkdir(path.join(source, "approvals", "revocations"), { recursive: true });
  await writeFile(path.join(source, "registry", "skill-a", "1.0.0.json"), "skill-a-v1\n", "utf8");
  await writeFile(path.join(source, "approvals", "approval-a.json"), "approval-a\n", "utf8");
  await writeFile(path.join(source, "approvals", "revocations", "approval-a.json"), "revoked-a\n", "utf8");
}

describe("GENESIS filesystem persistence assurance", () => {
  test("creates a deterministic SHA-256 manifest for every backed up file", async () => {
    const source = await root("genesis-persist-source-");
    const backup = await root("genesis-persist-backup-");
    await seed(source);

    const manifest = await createVerifiedBackup(source, backup);

    expect(manifest.version).toBe("GENESIS_PERSISTENCE_BACKUP_0.1.0");
    expect(manifest.files.map(file => file.path)).toEqual([
      "approvals/approval-a.json",
      "approvals/revocations/approval-a.json",
      "registry/skill-a/1.0.0.json"
    ]);
    expect(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    await expect(verifyBackup(backup)).resolves.toMatchObject({ files: manifest.files });
  });

  test("detects backup content tampering before restore", async () => {
    const source = await root("genesis-persist-source-");
    const backup = await root("genesis-persist-backup-");
    await seed(source);
    await createVerifiedBackup(source, backup);

    await writeFile(path.join(backup, "data", "approvals", "approval-a.json"), "tampered\n", "utf8");

    await expect(verifyBackup(backup)).rejects.toThrow(/PERSISTENCE_BACKUP_INTEGRITY_FAILURE/);
  });

  test("detects missing and unexpected files in a backup", async () => {
    const source = await root("genesis-persist-source-");
    const backup = await root("genesis-persist-backup-");
    await seed(source);
    await createVerifiedBackup(source, backup);

    await rm(path.join(backup, "data", "registry", "skill-a", "1.0.0.json"));
    await expect(verifyBackup(backup)).rejects.toThrow(/PERSISTENCE_BACKUP_FILE_SET_MISMATCH/);

    await createVerifiedBackup(source, backup, { replace: true });
    await writeFile(path.join(backup, "data", "unexpected.txt"), "unexpected\n", "utf8");
    await expect(verifyBackup(backup)).rejects.toThrow(/PERSISTENCE_BACKUP_FILE_SET_MISMATCH/);
  });

  test("restores only after integrity verification and reproduces original bytes", async () => {
    const source = await root("genesis-persist-source-");
    const backup = await root("genesis-persist-backup-");
    const target = await root("genesis-persist-target-");
    await seed(source);
    await createVerifiedBackup(source, backup);

    const restored = await restoreVerifiedBackup(backup, target);
    expect(restored.restoredFiles).toBe(3);
    expect(await readFile(path.join(target, "registry", "skill-a", "1.0.0.json"), "utf8"))
      .toBe("skill-a-v1\n");
    expect(await readFile(path.join(target, "approvals", "revocations", "approval-a.json"), "utf8"))
      .toBe("revoked-a\n");
  });

  test("restore is fail-closed when target is not empty", async () => {
    const source = await root("genesis-persist-source-");
    const backup = await root("genesis-persist-backup-");
    const target = await root("genesis-persist-target-");
    await seed(source);
    await createVerifiedBackup(source, backup);
    await writeFile(path.join(target, "existing.txt"), "do not overwrite\n", "utf8");

    await expect(restoreVerifiedBackup(backup, target)).rejects.toThrow(/PERSISTENCE_RESTORE_TARGET_NOT_EMPTY/);
    expect(await readFile(path.join(target, "existing.txt"), "utf8")).toBe("do not overwrite\n");
  });

  test("source symlinks are rejected instead of being followed into the backup", async () => {
    const source = await root("genesis-persist-source-");
    const backup = await root("genesis-persist-backup-");
    await seed(source);
    const fs = await import("node:fs/promises");
    await fs.symlink("/etc/passwd", path.join(source, "registry", "escape-link"));

    await expect(createVerifiedBackup(source, backup)).rejects.toThrow(/PERSISTENCE_SYMLINK_FORBIDDEN/);
  });
});
