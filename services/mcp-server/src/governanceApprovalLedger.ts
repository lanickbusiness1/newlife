import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BoundRequestContext } from "./auth.js";
import type { CompiledSkill } from "./skillFactory.js";
import type { InstallApprovals } from "./skillRegistry.js";

export const GENESIS_GOVERNANCE_APPROVAL_LEDGER_VERSION =
  "GENESIS_GOVERNANCE_APPROVAL_LEDGER_0.1.0" as const;

export type ApprovalKind = "double_review" | "m8";

export interface ApprovalSubject {
  skillId: string;
  version: string;
  fingerprint: string;
}

export interface GovernanceApprovalIntegrity {
  algorithm: "sha256";
  sha256: string;
}

export interface GovernanceApprovalEntry {
  ledgerVersion: typeof GENESIS_GOVERNANCE_APPROVAL_LEDGER_VERSION;
  approvalId: string;
  kind: ApprovalKind;
  decision: "approved";
  subject: ApprovalSubject;
  tenantId: string;
  actorId: string;
  agentId: string;
  issuer: string;
  roles: string[];
  amr: string[];
  correlationId: string;
  purpose: string;
  issuedAt: string;
  expiresAt: string;
  integrity: GovernanceApprovalIntegrity;
}

export interface InstallApprovalRefs {
  reviewApprovalId?: string;
  m8ApprovalId?: string;
}

interface ApprovalPayload {
  ledgerVersion: typeof GENESIS_GOVERNANCE_APPROVAL_LEDGER_VERSION;
  approvalId: string;
  kind: ApprovalKind;
  decision: "approved";
  subject: ApprovalSubject;
  tenantId: string;
  actorId: string;
  agentId: string;
  issuer: string;
  roles: string[];
  amr: string[];
  correlationId: string;
  purpose: string;
  issuedAt: string;
  expiresAt: string;
}

const MFA_AMR_VALUES = new Set(["mfa", "otp", "hwk", "swk", "fido", "webauthn"]);
const REVIEW_ROLES = new Set([
  "Reviewer",
  "M6 Reviewer",
  "S7+ Security Reviewer",
  "M8 Committee",
  "M8_REVIEWER",
  "S7_REVIEWER"
]);
const M8_ROLES = new Set(["M8 Committee", "M8_REVIEWER"]);

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter(key => object[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function fingerprintSkill(skill: CompiledSkill): string {
  return sha256(skill);
}

function hasMfa(amr: string[]): boolean {
  return amr.some(method => MFA_AMR_VALUES.has(method.toLowerCase()));
}

function hasRole(roles: string[], allowed: Set<string>): boolean {
  return roles.some(role => allowed.has(role));
}

function assertAuthority(kind: ApprovalKind, ctx: BoundRequestContext): void {
  const requiredScope = kind === "m8" ? "genome:skill:m8" : "genome:skill:review";
  if (!ctx.permissionScope.includes(requiredScope)) {
    throw new Error(`APPROVAL_SCOPE_REQUIRED:${kind}`);
  }

  const roleAllowed = kind === "m8"
    ? hasRole(ctx.roles, M8_ROLES)
    : hasRole(ctx.roles, REVIEW_ROLES);
  if (!roleAllowed) throw new Error(`APPROVAL_ROLE_REQUIRED:${kind}`);
  if (!hasMfa(ctx.amr)) throw new Error(`APPROVAL_MFA_REQUIRED:${kind}`);
}

function safeApprovalId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("APPROVAL_ID_INVALID");
  }
  return value;
}

function integrityPayload(entry: GovernanceApprovalEntry): ApprovalPayload {
  return {
    ledgerVersion: entry.ledgerVersion,
    approvalId: entry.approvalId,
    kind: entry.kind,
    decision: entry.decision,
    subject: entry.subject,
    tenantId: entry.tenantId,
    actorId: entry.actorId,
    agentId: entry.agentId,
    issuer: entry.issuer,
    roles: entry.roles,
    amr: entry.amr,
    correlationId: entry.correlationId,
    purpose: entry.purpose,
    issuedAt: entry.issuedAt,
    expiresAt: entry.expiresAt
  };
}

function entryWithIntegrity(payload: ApprovalPayload): GovernanceApprovalEntry {
  return {
    ...payload,
    integrity: { algorithm: "sha256", sha256: sha256(payload) }
  };
}

function validateAttestationForSkill(
  entry: GovernanceApprovalEntry,
  expectedKind: ApprovalKind,
  skill: CompiledSkill,
  tenantId: string
): void {
  if (entry.kind !== expectedKind) throw new Error(`APPROVAL_KIND_MISMATCH:${expectedKind}`);
  if (entry.tenantId !== tenantId) throw new Error("APPROVAL_TENANT_MISMATCH");
  if (
    entry.subject.skillId !== skill.id ||
    entry.subject.version !== skill.version ||
    entry.subject.fingerprint !== fingerprintSkill(skill)
  ) {
    throw new Error("APPROVAL_SUBJECT_MISMATCH");
  }
  if (Date.now() >= Date.parse(entry.expiresAt)) throw new Error("APPROVAL_EXPIRED");
}

export class GovernanceApprovalLedger {
  readonly rootDir: string;
  readonly ttlSeconds: number;

  constructor(
    rootDir = process.env.GOVERNANCE_APPROVAL_DIR ?? path.resolve(process.cwd(), ".governance-approvals"),
    ttlSeconds = Number(process.env.GOVERNANCE_APPROVAL_TTL_SECONDS ?? 3600)
  ) {
    this.rootDir = path.resolve(rootDir);
    if (!Number.isFinite(ttlSeconds) || ttlSeconds < 0) {
      throw new Error("APPROVAL_TTL_INVALID");
    }
    this.ttlSeconds = ttlSeconds;
  }

  recordPath(approvalId: string): string {
    const safe = safeApprovalId(approvalId);
    const record = path.resolve(this.rootDir, `${safe}.json`);
    const relative = path.relative(this.rootDir, record);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("APPROVAL_PATH_ESCAPE");
    }
    return record;
  }

  private async writeNew(entry: GovernanceApprovalEntry): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const record = this.recordPath(entry.approvalId);
    const temporary = `${record}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    try {
      await link(temporary, record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error("APPROVAL_ID_COLLISION");
      }
      throw error;
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  async attest(
    skill: CompiledSkill,
    kind: ApprovalKind,
    ctx: BoundRequestContext
  ): Promise<GovernanceApprovalEntry> {
    if (skill.status === "blocked") throw new Error("APPROVAL_SKILL_BLOCKED");
    assertAuthority(kind, ctx);

    if (kind === "m8" && !skill.m8ApprovalRequired) {
      throw new Error("APPROVAL_NOT_REQUIRED:m8");
    }
    if (kind === "double_review" && !skill.doubleReviewRequired) {
      throw new Error("APPROVAL_NOT_REQUIRED:double_review");
    }

    const approvalId = randomUUID();
    const issuedAtMs = Date.now();
    const payload: ApprovalPayload = {
      ledgerVersion: GENESIS_GOVERNANCE_APPROVAL_LEDGER_VERSION,
      approvalId,
      kind,
      decision: "approved",
      subject: {
        skillId: skill.id,
        version: skill.version,
        fingerprint: fingerprintSkill(skill)
      },
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      agentId: ctx.agentId,
      issuer: ctx.issuer,
      roles: [...ctx.roles],
      amr: [...ctx.amr],
      correlationId: ctx.correlationId,
      purpose: ctx.purpose,
      issuedAt: new Date(issuedAtMs).toISOString(),
      expiresAt: new Date(issuedAtMs + this.ttlSeconds * 1000).toISOString()
    };
    const entry = entryWithIntegrity(payload);
    await this.writeNew(entry);
    return entry;
  }

  async read(approvalId: string): Promise<GovernanceApprovalEntry> {
    const raw = await readFile(this.recordPath(approvalId), "utf8");
    const entry = JSON.parse(raw) as GovernanceApprovalEntry;
    if (
      entry.ledgerVersion !== GENESIS_GOVERNANCE_APPROVAL_LEDGER_VERSION ||
      entry.integrity?.algorithm !== "sha256" ||
      entry.integrity.sha256 !== sha256(integrityPayload(entry))
    ) {
      throw new Error("APPROVAL_INTEGRITY_FAILURE");
    }
    return entry;
  }

  async verifyInstall(
    skill: CompiledSkill,
    refs: InstallApprovalRefs,
    installer: BoundRequestContext
  ): Promise<InstallApprovals> {
    if (skill.status === "blocked") throw new Error("SKILL_INSTALL_BLOCKED");

    const requiresReview = skill.doubleReviewRequired;
    const requiresM8 = skill.m8ApprovalRequired || skill.status === "m8_required";

    if (requiresReview && !refs.reviewApprovalId) throw new Error("DOUBLE_REVIEW_ATTESTATION_REQUIRED");
    if (requiresM8 && !refs.m8ApprovalId) throw new Error("M8_ATTESTATION_REQUIRED");

    const review = refs.reviewApprovalId ? await this.read(refs.reviewApprovalId) : undefined;
    const m8 = refs.m8ApprovalId ? await this.read(refs.m8ApprovalId) : undefined;

    if (review) validateAttestationForSkill(review, "double_review", skill, installer.tenantId);
    if (m8) validateAttestationForSkill(m8, "m8", skill, installer.tenantId);

    const actors = [installer.actorId, review?.actorId, m8?.actorId].filter(
      (value): value is string => Boolean(value)
    );
    if (new Set(actors).size !== actors.length) {
      throw new Error("APPROVAL_SEPARATION_OF_DUTIES");
    }

    return {
      doubleReview: Boolean(review),
      m8Approval: Boolean(m8)
    };
  }
}
