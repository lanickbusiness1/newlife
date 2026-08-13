import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SKILL_REUSE_THRESHOLD,
  scoreSkillCompatibility,
  type CompiledSkill,
  type SkillRequest
} from "./skillFactory.js";

export const GENESIS_SKILL_REGISTRY_VERSION = "GENESIS_SKILL_REGISTRY_0.2.0" as const;

export interface RegistryLifecycle {
  status: "active" | "deprecated";
  deprecatedAt?: string;
  replacement?: { id: string; version: string };
}

export interface RegistryIntegrity {
  algorithm: "sha256";
  sha256: string;
}

export interface RegistryEntry {
  registryVersion: typeof GENESIS_SKILL_REGISTRY_VERSION;
  skill: CompiledSkill;
  installedAt: string;
  lifecycle: RegistryLifecycle;
  integrity: RegistryIntegrity;
}

export interface InstallApprovals {
  doubleReview?: boolean;
  m8Approval?: boolean;
}

export interface RegistryMatch {
  best: RegistryEntry | null;
  score: number;
  decision: "reuse_or_compose" | "compile_gap";
}

interface IntegrityPayload {
  registryVersion: typeof GENESIS_SKILL_REGISTRY_VERSION;
  skill: CompiledSkill;
  installedAt: string;
  lifecycle: RegistryLifecycle;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function digest(payload: IntegrityPayload): string {
  return createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex");
}

function safeSegment(value: string): string {
  if (!value || value === "." || value === "..") {
    throw new Error("SKILL_REGISTRY_INVALID_PATH_SEGMENT");
  }
  const normalized = value.replace(/[^A-Za-z0-9._-]/g, "_");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("SKILL_REGISTRY_INVALID_PATH_SEGMENT");
  }
  return normalized;
}

export class SkillRegistry {
  readonly rootDir: string;

  constructor(rootDir = process.env.SKILL_REGISTRY_DIR ?? path.resolve(process.cwd(), ".skill-registry")) {
    this.rootDir = path.resolve(rootDir);
  }

  recordPath(id: string, version: string): string {
    const directory = path.resolve(this.rootDir, safeSegment(id));
    const record = path.resolve(directory, `${safeSegment(version)}.json`);
    const relative = path.relative(this.rootDir, record);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("SKILL_REGISTRY_PATH_ESCAPE");
    }
    return record;
  }

  private payload(entry: RegistryEntry): IntegrityPayload {
    return {
      registryVersion: entry.registryVersion,
      skill: entry.skill,
      installedAt: entry.installedAt,
      lifecycle: entry.lifecycle
    };
  }

  private withIntegrity(payload: IntegrityPayload): RegistryEntry {
    return {
      ...payload,
      integrity: {
        algorithm: "sha256",
        sha256: digest(payload)
      }
    };
  }

  private async writeEntry(entry: RegistryEntry): Promise<void> {
    const record = this.recordPath(entry.skill.id, entry.skill.version);
    await mkdir(path.dirname(record), { recursive: true });
    const temporary = `${record}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    await rename(temporary, record);
  }

  async install(skill: CompiledSkill, approvals: InstallApprovals = {}): Promise<RegistryEntry> {
    if (skill.status === "blocked") {
      throw new Error("SKILL_INSTALL_BLOCKED");
    }
    if (skill.status === "alert_ready" && !approvals.doubleReview) {
      throw new Error("DOUBLE_REVIEW_REQUIRED");
    }
    if (skill.status === "m8_required" && !approvals.m8Approval) {
      throw new Error("M8_APPROVAL_REQUIRED");
    }

    const payload: IntegrityPayload = {
      registryVersion: GENESIS_SKILL_REGISTRY_VERSION,
      skill,
      installedAt: new Date().toISOString(),
      lifecycle: { status: "active" }
    };
    const entry = this.withIntegrity(payload);
    await this.writeEntry(entry);
    return entry;
  }

  async read(id: string, version: string): Promise<RegistryEntry> {
    const raw = await readFile(this.recordPath(id, version), "utf8");
    const entry = JSON.parse(raw) as RegistryEntry;
    if (
      entry.registryVersion !== GENESIS_SKILL_REGISTRY_VERSION ||
      entry.integrity?.algorithm !== "sha256" ||
      entry.integrity.sha256 !== digest(this.payload(entry))
    ) {
      throw new Error("SKILL_REGISTRY_INTEGRITY_FAILURE");
    }
    return entry;
  }

  async list(): Promise<RegistryEntry[]> {
    let skillDirectories;
    try {
      skillDirectories = await readdir(this.rootDir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const entries: RegistryEntry[] = [];
    for (const directory of skillDirectories) {
      if (!directory.isDirectory()) continue;
      const directoryPath = path.join(this.rootDir, directory.name);
      const files = await readdir(directoryPath, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".json")) continue;
        const raw = await readFile(path.join(directoryPath, file.name), "utf8");
        const parsed = JSON.parse(raw) as RegistryEntry;
        entries.push(await this.read(parsed.skill.id, parsed.skill.version));
      }
    }
    return entries.sort((left, right) => {
      const idOrder = left.skill.id.localeCompare(right.skill.id);
      return idOrder !== 0 ? idOrder : left.skill.version.localeCompare(right.skill.version);
    });
  }

  async match(request: SkillRequest): Promise<RegistryMatch> {
    const candidates = (await this.list()).filter(entry => entry.lifecycle.status === "active");
    if (candidates.length === 0) {
      return { best: null, score: 0, decision: "compile_gap" };
    }

    const ranked = candidates
      .map(entry => ({ entry, score: scoreSkillCompatibility(request, entry.skill) }))
      .sort((left, right) => right.score - left.score);
    const best = ranked[0];
    if (!best) {
      return { best: null, score: 0, decision: "compile_gap" };
    }
    return {
      best: best.entry,
      score: best.score,
      decision: best.score >= SKILL_REUSE_THRESHOLD ? "reuse_or_compose" : "compile_gap"
    };
  }

  async deprecate(
    id: string,
    version: string,
    replacement?: { id: string; version: string }
  ): Promise<RegistryEntry> {
    const existing = await this.read(id, version);
    const payload: IntegrityPayload = {
      registryVersion: existing.registryVersion,
      skill: existing.skill,
      installedAt: existing.installedAt,
      lifecycle: {
        status: "deprecated",
        deprecatedAt: new Date().toISOString(),
        ...(replacement ? { replacement } : {})
      }
    };
    const updated = this.withIntegrity(payload);
    await this.writeEntry(updated);
    return updated;
  }
}
