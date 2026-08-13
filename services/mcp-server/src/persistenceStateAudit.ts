import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const GENESIS_PERSISTENCE_STATE_AUDIT_VERSION = "GENESIS_PERSISTENCE_STATE_AUDIT_0.1.0" as const;

export type LockClassification = "active" | "stale_candidate" | "malformed";

export interface PersistenceLockFinding {
  subsystem: "persistence" | "approval";
  kind: "snapshot" | "mutation" | "approval_operation";
  path: string;
  classification: LockClassification;
  ageMs: number | null;
  approvalId?: string;
  mutationId?: string;
  label?: string;
  pid?: number;
  startedAt?: string;
  autoRecoverable: false;
  recommendedAction: string;
}

export interface PersistenceStateAuditInput {
  stateRoot: string;
  approvalRoot: string;
  staleAfterMs: number;
}

export interface PersistenceStateAuditReport {
  version: typeof GENESIS_PERSISTENCE_STATE_AUDIT_VERSION;
  checkedAt: string;
  status: "clean" | "busy" | "attention_required";
  active: number;
  staleCandidates: number;
  malformed: number;
  locks: PersistenceLockFinding[];
}

interface CoordinatorMetadata {
  pid: number;
  startedAt: string;
  mutationId?: string;
  label?: string;
}

function validateThreshold(staleAfterMs: number): void {
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
    throw new Error("PERSISTENCE_AUDIT_STALE_THRESHOLD_INVALID");
  }
}

async function existsDirectory(target: string): Promise<boolean> {
  try {
    const stat = await lstat(target);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function ageFromTimestamp(timestamp: string, now: number): number | null {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, now - parsed);
}

function classifyAge(ageMs: number, staleAfterMs: number): LockClassification {
  return ageMs > staleAfterMs ? "stale_candidate" : "active";
}

function recommendation(classification: LockClassification): string {
  if (classification === "active") return "observe_until_operation_completes";
  if (classification === "stale_candidate") {
    return "manual_recovery_required:confirm_owner_dead_and_storage_consistency_before_removal";
  }
  return "manual_recovery_required:metadata_invalid_do_not_remove_automatically";
}

async function parseCoordinatorMetadata(lockDir: string): Promise<CoordinatorMetadata | null> {
  try {
    const raw = await readFile(path.join(lockDir, "metadata.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<CoordinatorMetadata>;
    if (
      typeof parsed.pid !== "number" ||
      !Number.isInteger(parsed.pid) ||
      typeof parsed.startedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.startedAt))
    ) {
      return null;
    }
    if (parsed.mutationId !== undefined && typeof parsed.mutationId !== "string") return null;
    if (parsed.label !== undefined && typeof parsed.label !== "string") return null;
    return {
      pid: parsed.pid,
      startedAt: parsed.startedAt,
      ...(parsed.mutationId ? { mutationId: parsed.mutationId } : {}),
      ...(parsed.label ? { label: parsed.label } : {})
    };
  } catch {
    return null;
  }
}

async function inspectCoordinatorLock(
  lockDir: string,
  kind: "snapshot" | "mutation",
  staleAfterMs: number,
  now: number,
  mutationId?: string
): Promise<PersistenceLockFinding> {
  const metadata = await parseCoordinatorMetadata(lockDir);
  if (!metadata) {
    return {
      subsystem: "persistence",
      kind,
      path: lockDir,
      classification: "malformed",
      ageMs: null,
      ...(mutationId ? { mutationId } : {}),
      autoRecoverable: false,
      recommendedAction: recommendation("malformed")
    };
  }

  if (kind === "mutation" && mutationId && metadata.mutationId !== mutationId) {
    return {
      subsystem: "persistence",
      kind,
      path: lockDir,
      classification: "malformed",
      ageMs: null,
      mutationId,
      autoRecoverable: false,
      recommendedAction: recommendation("malformed")
    };
  }

  const ageMs = ageFromTimestamp(metadata.startedAt, now);
  if (ageMs === null) {
    return {
      subsystem: "persistence",
      kind,
      path: lockDir,
      classification: "malformed",
      ageMs: null,
      ...(mutationId ? { mutationId } : {}),
      autoRecoverable: false,
      recommendedAction: recommendation("malformed")
    };
  }
  const classification = classifyAge(ageMs, staleAfterMs);
  return {
    subsystem: "persistence",
    kind,
    path: lockDir,
    classification,
    ageMs,
    ...(mutationId ? { mutationId } : {}),
    ...(metadata.label ? { label: metadata.label } : {}),
    pid: metadata.pid,
    startedAt: metadata.startedAt,
    autoRecoverable: false,
    recommendedAction: recommendation(classification)
  };
}

async function coordinatorFindings(
  stateRoot: string,
  staleAfterMs: number,
  now: number
): Promise<PersistenceLockFinding[]> {
  const findings: PersistenceLockFinding[] = [];
  const snapshot = path.join(stateRoot, "snapshot.lock");
  if (await existsDirectory(snapshot)) {
    findings.push(await inspectCoordinatorLock(snapshot, "snapshot", staleAfterMs, now));
  }

  const mutationRoot = path.join(stateRoot, "mutations");
  if (await existsDirectory(mutationRoot)) {
    const entries = await readdir(mutationRoot, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || !entry.name.endsWith(".lock")) continue;
      const mutationId = entry.name.slice(0, -5);
      findings.push(await inspectCoordinatorLock(
        path.join(mutationRoot, entry.name),
        "mutation",
        staleAfterMs,
        now,
        mutationId
      ));
    }
  }
  return findings;
}

async function approvalFindings(
  approvalRoot: string,
  staleAfterMs: number,
  now: number
): Promise<PersistenceLockFinding[]> {
  const locksRoot = path.join(approvalRoot, "locks");
  if (!(await existsDirectory(locksRoot))) return [];

  const findings: PersistenceLockFinding[] = [];
  const entries = await readdir(locksRoot, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !entry.name.endsWith(".lock")) continue;
    const approvalId = entry.name.slice(0, -5);
    const lockPath = path.join(locksRoot, entry.name);
    const stat = await lstat(lockPath);
    const ageMs = Math.max(0, now - stat.mtimeMs);
    const classification = classifyAge(ageMs, staleAfterMs);
    findings.push({
      subsystem: "approval",
      kind: "approval_operation",
      path: lockPath,
      classification,
      ageMs,
      approvalId,
      autoRecoverable: false,
      recommendedAction: recommendation(classification)
    });
  }
  return findings;
}

export async function auditPersistenceState(
  input: PersistenceStateAuditInput
): Promise<PersistenceStateAuditReport> {
  validateThreshold(input.staleAfterMs);
  const now = Date.now();
  const stateRoot = path.resolve(input.stateRoot);
  const approvalRoot = path.resolve(input.approvalRoot);
  const locks = [
    ...(await coordinatorFindings(stateRoot, input.staleAfterMs, now)),
    ...(await approvalFindings(approvalRoot, input.staleAfterMs, now))
  ];

  const active = locks.filter(lock => lock.classification === "active").length;
  const staleCandidates = locks.filter(lock => lock.classification === "stale_candidate").length;
  const malformed = locks.filter(lock => lock.classification === "malformed").length;
  const status = staleCandidates > 0 || malformed > 0
    ? "attention_required"
    : locks.length > 0
      ? "busy"
      : "clean";

  return {
    version: GENESIS_PERSISTENCE_STATE_AUDIT_VERSION,
    checkedAt: new Date(now).toISOString(),
    status,
    active,
    staleCandidates,
    malformed,
    locks
  };
}
