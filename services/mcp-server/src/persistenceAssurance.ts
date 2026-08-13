import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

export const GENESIS_PERSISTENCE_BACKUP_VERSION = "GENESIS_PERSISTENCE_BACKUP_0.1.0" as const;

export interface BackupManifestFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  version: typeof GENESIS_PERSISTENCE_BACKUP_VERSION;
  createdAt: string;
  files: BackupManifestFile[];
}

export interface CreateBackupOptions {
  replace?: boolean;
}

export interface RestoreResult {
  restoredFiles: number;
  manifest: BackupManifest;
}

const MANIFEST_NAME = "manifest.json";
const DATA_DIRECTORY = "data";

function digest(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function normalizedRelative(root: string, absolute: string): string {
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("PERSISTENCE_PATH_ESCAPE");
  }
  return relative.split(path.sep).join("/");
}

function resolveManifestPath(root: string, relative: string): string {
  if (!relative || relative.startsWith("/") || relative.includes("\\")) {
    throw new Error("PERSISTENCE_MANIFEST_PATH_INVALID");
  }
  const segments = relative.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("PERSISTENCE_MANIFEST_PATH_INVALID");
  }
  const absolute = path.resolve(root, ...segments);
  const rel = path.relative(root, absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("PERSISTENCE_MANIFEST_PATH_ESCAPE");
  }
  return absolute;
}

async function assertDirectoryRoot(root: string, missingCode: string): Promise<void> {
  let stat;
  try {
    stat = await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(missingCode);
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error("PERSISTENCE_SYMLINK_FORBIDDEN");
  if (!stat.isDirectory()) throw new Error("PERSISTENCE_DIRECTORY_REQUIRED");
}

async function walkFiles(root: string): Promise<string[]> {
  await assertDirectoryRoot(root, "PERSISTENCE_SOURCE_MISSING");
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("PERSISTENCE_SYMLINK_FORBIDDEN");
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!entry.isFile()) throw new Error("PERSISTENCE_UNSUPPORTED_ENTRY");
      files.push(normalizedRelative(root, absolute));
    }
  }

  await visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

async function directoryIsEmpty(directory: string): Promise<boolean> {
  try {
    const stat = await lstat(directory);
    if (stat.isSymbolicLink()) throw new Error("PERSISTENCE_SYMLINK_FORBIDDEN");
    if (!stat.isDirectory()) return false;
    return (await readdir(directory)).length === 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

function assertSeparatedRoots(source: string, backup: string): void {
  if (source === backup) throw new Error("PERSISTENCE_ROOT_COLLISION");
  const backupRelativeToSource = path.relative(source, backup);
  if (backupRelativeToSource && !backupRelativeToSource.startsWith("..") && !path.isAbsolute(backupRelativeToSource)) {
    throw new Error("PERSISTENCE_BACKUP_INSIDE_SOURCE");
  }
  const sourceRelativeToBackup = path.relative(backup, source);
  if (sourceRelativeToBackup && !sourceRelativeToBackup.startsWith("..") && !path.isAbsolute(sourceRelativeToBackup)) {
    throw new Error("PERSISTENCE_SOURCE_INSIDE_BACKUP");
  }
}

function parseManifest(raw: string): BackupManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("PERSISTENCE_BACKUP_MANIFEST_INVALID");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("PERSISTENCE_BACKUP_MANIFEST_INVALID");
  const manifest = parsed as Partial<BackupManifest>;
  if (
    manifest.version !== GENESIS_PERSISTENCE_BACKUP_VERSION ||
    typeof manifest.createdAt !== "string" ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error("PERSISTENCE_BACKUP_MANIFEST_INVALID");
  }

  const seen = new Set<string>();
  const files: BackupManifestFile[] = manifest.files.map(item => {
    if (
      !item ||
      typeof item.path !== "string" ||
      typeof item.bytes !== "number" ||
      !Number.isInteger(item.bytes) ||
      item.bytes < 0 ||
      typeof item.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.sha256)
    ) {
      throw new Error("PERSISTENCE_BACKUP_MANIFEST_INVALID");
    }
    resolveManifestPath("/virtual-root", item.path);
    if (seen.has(item.path)) throw new Error("PERSISTENCE_BACKUP_MANIFEST_DUPLICATE_PATH");
    seen.add(item.path);
    return { path: item.path, bytes: item.bytes, sha256: item.sha256 };
  });

  return {
    version: GENESIS_PERSISTENCE_BACKUP_VERSION,
    createdAt: manifest.createdAt,
    files
  };
}

export async function createVerifiedBackup(
  sourceDir: string,
  backupDir: string,
  options: CreateBackupOptions = {}
): Promise<BackupManifest> {
  const source = path.resolve(sourceDir);
  const backup = path.resolve(backupDir);
  assertSeparatedRoots(source, backup);
  await assertDirectoryRoot(source, "PERSISTENCE_SOURCE_MISSING");

  const empty = await directoryIsEmpty(backup);
  if (!empty && !options.replace) throw new Error("PERSISTENCE_BACKUP_TARGET_NOT_EMPTY");
  if (options.replace) {
    await rm(path.join(backup, DATA_DIRECTORY), { recursive: true, force: true });
    await rm(path.join(backup, MANIFEST_NAME), { force: true });
    const leftovers = await readdir(backup).catch(error => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [] as string[];
      throw error;
    });
    if (leftovers.length > 0) throw new Error("PERSISTENCE_BACKUP_TARGET_NOT_EMPTY");
  }

  await mkdir(path.join(backup, DATA_DIRECTORY), { recursive: true });
  const relativeFiles = await walkFiles(source);
  const files: BackupManifestFile[] = [];

  for (const relative of relativeFiles) {
    const sourceFile = resolveManifestPath(source, relative);
    const bytes = await readFile(sourceFile);
    const targetFile = resolveManifestPath(path.join(backup, DATA_DIRECTORY), relative);
    await mkdir(path.dirname(targetFile), { recursive: true });
    await writeFile(targetFile, bytes);
    files.push({ path: relative, bytes: bytes.length, sha256: digest(bytes) });
  }

  const manifest: BackupManifest = {
    version: GENESIS_PERSISTENCE_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    files
  };
  await writeFile(
    path.join(backup, MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  await verifyBackup(backup);
  return manifest;
}

export async function verifyBackup(backupDir: string): Promise<BackupManifest> {
  const backup = path.resolve(backupDir);
  await assertDirectoryRoot(backup, "PERSISTENCE_BACKUP_MISSING");

  let raw: string;
  try {
    raw = await readFile(path.join(backup, MANIFEST_NAME), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("PERSISTENCE_BACKUP_MANIFEST_MISSING");
    }
    throw error;
  }
  const manifest = parseManifest(raw);

  const dataRoot = path.join(backup, DATA_DIRECTORY);
  const actualFiles = await walkFiles(dataRoot).catch(error => {
    if (error instanceof Error && error.message === "PERSISTENCE_SOURCE_MISSING") {
      return [] as string[];
    }
    throw error;
  });
  const expectedFiles = manifest.files.map(file => file.path).sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error("PERSISTENCE_BACKUP_FILE_SET_MISMATCH");
  }

  for (const expected of manifest.files) {
    const absolute = resolveManifestPath(dataRoot, expected.path);
    const bytes = await readFile(absolute);
    if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256) {
      throw new Error(`PERSISTENCE_BACKUP_INTEGRITY_FAILURE:${expected.path}`);
    }
  }

  return manifest;
}

export async function restoreVerifiedBackup(
  backupDir: string,
  targetDir: string
): Promise<RestoreResult> {
  const backup = path.resolve(backupDir);
  const target = path.resolve(targetDir);
  assertSeparatedRoots(target, backup);
  const manifest = await verifyBackup(backup);

  if (!(await directoryIsEmpty(target))) {
    throw new Error("PERSISTENCE_RESTORE_TARGET_NOT_EMPTY");
  }
  await mkdir(target, { recursive: true });

  const dataRoot = path.join(backup, DATA_DIRECTORY);
  for (const file of manifest.files) {
    const source = resolveManifestPath(dataRoot, file.path);
    const destination = resolveManifestPath(target, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(source));
  }

  return { restoredFiles: manifest.files.length, manifest };
}
