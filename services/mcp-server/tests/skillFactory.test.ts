import { describe, expect, test } from "vitest";
import {
  compileSkill,
  evaluatePromotion,
  scoreSkillCompatibility,
  type SkillFactoryInput,
  type SkillRecord,
  type SkillRequest
} from "../src/skillFactory";

const coveredContext = {
  languageSemantic: { status: "covered" as const, evidenceRefs: ["S99-LANG-001"] },
  regulatoryLegal: { status: "covered" as const, evidenceRefs: ["S99-LEGAL-001"] },
  institutional: { status: "covered" as const, evidenceRefs: ["S99-INST-001"] },
  economicFinancialPayment: { status: "covered" as const, evidenceRefs: ["S99-ECO-001"] },
  culturalHumanAdoption: { status: "covered" as const, evidenceRefs: ["S99-CULT-001"] },
  infrastructureResilience: { status: "covered" as const, evidenceRefs: ["S99-INFRA-001"] },
  marketBusinessRevenue: { status: "covered" as const, evidenceRefs: ["S99-MKT-001"] },
  technologyDataAgenticAI: { status: "covered" as const, evidenceRefs: ["S99-TECH-001"] },
  governanceSovereigntyAssurance: { status: "covered" as const, evidenceRefs: ["S99-GOV-001"] }
};

function validInput(overrides: Partial<SkillFactoryInput> = {}): SkillFactoryInput {
  return {
    id: "procurement.supplier.verify",
    version: "1.0.0",
    level: "L3",
    domain: "govtech.procurement",
    problem: "verify supplier eligibility before bid submission",
    triggers: ["supplier onboarding", "bid submission"],
    inputs: ["supplier_profile", "registration_evidence"],
    outputs: ["eligibility_status", "evidence_bundle"],
    dependencies: ["supplier_registry"],
    connectors: ["national_company_registry"],
    permissions: ["supplier:read", "evidence:read"],
    procedure: ["validate supplier identity", "verify registration evidence", "emit auditable decision"],
    verification: ["unit tests", "adversarial fixtures", "human legal review"],
    remeEvidence: ["REME-MRU-PROC-001"],
    metrics: ["verification_accuracy", "manual_review_rate"],
    rollback: "disable skill version and restore previous registry pointer",
    languages: ["en"],
    countries: ["LR"],
    riskDomains: [],
    warnings: [],
    context: coveredContext,
    stratex9: { status: "go", evidenceRefs: ["STRATEX9-MRU-001"] },
    outcomeEvidencePresent: true,
    localRulesSeparated: true,
    permissionsBounded: true,
    doubleReviewPassed: true,
    secondContextTestPassed: true,
    hardcodedNationalRule: false,
    ...overrides
  };
}

describe("GENESIS V4 Continental Skill Factory", () => {
  test("rejects structurally invalid Skill DNA", () => {
    expect(() => compileSkill({})).toThrow(/SKILL_DNA_INVALID/);
  });

  test("blocks territorial skills without STRATEX-99 context", () => {
    const output = compileSkill(validInput({ context: undefined }));

    expect(output.status).toBe("blocked");
    expect(output.blockers).toContain("STRATEX99_CONTEXT_REQUIRED");
  });

  test("blocks territorial skills when a critical STRATEX-99 layer is only partial", () => {
    const output = compileSkill(validInput({
      context: {
        ...coveredContext,
        regulatoryLegal: { status: "partial", evidenceRefs: ["LEGAL-GAP-001"] }
      }
    }));

    expect(output.status).toBe("blocked");
    expect(output.blockers).toContain("STRATEX99_CRITICAL_CONTEXT_INCOMPLETE:regulatoryLegal");
  });

  test("blocks destructive procedure content at S7+", () => {
    const output = compileSkill(validInput({ procedure: ["sudo rm -rf /tmp/supplier-cache"] }));

    expect(output.status).toBe("blocked");
    expect(output.gates.s7plus).toBe("fail");
    expect(output.blockers).toContain("S7_DESTRUCTIVE_CONTENT");
  });

  test("requires M8 for sensitive payment scope", () => {
    const output = compileSkill(validInput({ riskDomains: ["payment"] }));

    expect(output.status).toBe("m8_required");
    expect(output.gates.m8).toBe("conditional");
    expect(output.m8ApprovalRequired).toBe(true);
  });

  test("allows bounded non-sensitive warnings only as alert_ready with double review", () => {
    const output = compileSkill(validInput({ warnings: ["missing optional second benchmark"] }));

    expect(output.status).toBe("alert_ready");
    expect(output.gates.m6).toBe("conditional");
    expect(output.doubleReviewRequired).toBe(true);
  });

  test("compiles a complete non-sensitive skill as draft_ready", () => {
    const output = compileSkill(validInput());

    expect(output.status).toBe("draft_ready");
    expect(output.gates.m6).toBe("pass");
    expect(output.gates.s7plus).toBe("pass");
    expect(output.gates.m8).toBe("pass");
  });

  test("scores a strongly matching registry candidate at or above the 80 percent reuse threshold", () => {
    const request: SkillRequest = {
      level: "L3",
      domain: "govtech.procurement",
      problem: "verify supplier eligibility before bid submission",
      triggers: ["supplier onboarding", "bid submission"],
      inputs: ["supplier_profile", "registration_evidence"],
      outputs: ["eligibility_status", "evidence_bundle"],
      dependencies: ["supplier_registry"],
      connectors: ["national_company_registry"],
      permissions: ["supplier:read", "evidence:read"],
      countries: ["SL"]
    };
    const candidate: SkillRecord = {
      ...validInput({ countries: ["LR", "SL"] }),
      status: "draft_ready",
      gates: { m6: "pass", s7plus: "pass", m8: "pass" },
      blockers: [],
      alerts: [],
      doubleReviewRequired: false,
      m8ApprovalRequired: false
    };

    expect(scoreSkillCompatibility(request, candidate)).toBeGreaterThanOrEqual(0.8);
  });

  test("scores a materially different domain below the reuse threshold", () => {
    const request: SkillRequest = {
      level: "L3",
      domain: "health.telemedicine",
      problem: "triage remote patient symptoms",
      triggers: ["patient consultation"],
      inputs: ["symptoms"],
      outputs: ["triage_advice"],
      dependencies: ["clinical_protocol"],
      connectors: ["ehr"],
      permissions: ["health:read"],
      countries: ["GN"]
    };
    const candidate: SkillRecord = {
      ...validInput(),
      status: "draft_ready",
      gates: { m6: "pass", s7plus: "pass", m8: "pass" },
      blockers: [],
      alerts: [],
      doubleReviewRequired: false,
      m8ApprovalRequired: false
    };

    expect(scoreSkillCompatibility(request, candidate)).toBeLessThan(0.8);
  });

  test("rejects regional promotion when the second-context test has not passed", () => {
    const decision = evaluatePromotion({
      fromLevel: "L3",
      toLevel: "L2",
      outcomeEvidencePresent: true,
      localRulesSeparated: true,
      permissionsBounded: true,
      doubleReviewPassed: true,
      rollbackPresent: true,
      secondContextTestPassed: false,
      hardcodedNationalRule: false
    });

    expect(decision.allowed).toBe(false);
    expect(decision.blockers).toContain("SECOND_CONTEXT_TEST_REQUIRED");
  });

  test("rejects promotion when a national rule leaks into generic core", () => {
    const decision = evaluatePromotion({
      fromLevel: "L3",
      toLevel: "L1",
      outcomeEvidencePresent: true,
      localRulesSeparated: true,
      permissionsBounded: true,
      doubleReviewPassed: true,
      rollbackPresent: true,
      secondContextTestPassed: true,
      hardcodedNationalRule: true
    });

    expect(decision.allowed).toBe(false);
    expect(decision.blockers).toContain("HARDCODED_NATIONAL_RULE_FORBIDDEN");
  });
});
