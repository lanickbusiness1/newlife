import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  compileNistCsfAiAssessment,
  NIST_CSF_AI_ASSESSMENT_ANCHOR
} from "../src/nistCsfAiAssessment";

describe("NIST SP 1353 AI-assisted CSF assessment control", () => {
  test("compiles a governance review with complete evidence coverage", () => {
    const plan = compileNistCsfAiAssessment({
      organizationId: "public-agency-bj",
      useCase: "governance_review",
      dataClassification: "internal",
      evidence: [
        { evidenceRef: "evidence://policy/1", kind: "policy", summary: "Cybersecurity policy" },
        { evidenceRef: "evidence://strategy/1", kind: "strategy", summary: "Security strategy" },
        { evidenceRef: "evidence://risk/1", kind: "risk_governance", summary: "Risk governance record" }
      ]
    });

    expect(plan.artifactType).toBe("GOVERNANCE_REVIEW");
    expect(plan.evidenceCoverage.missingKinds).toEqual([]);
    expect(plan.assuranceClaimAllowed).toBe(false);
  });

  test("records missing evidence instead of inventing current-state findings", () => {
    const plan = compileNistCsfAiAssessment({
      organizationId: "enterprise-ci",
      useCase: "current_state_profile",
      dataClassification: "public",
      evidence: [{ evidenceRef: "evidence://artifact/1", kind: "artifact", summary: "Asset inventory" }]
    });

    expect(plan.evidenceCoverage.missingKinds).toEqual(["interview"]);
    expect(plan.observedGaps).toContain("MISSING_EVIDENCE_KIND:interview");
    expect(plan.executionPolicy).toBe("DRAFT_REQUIRES_HUMAN_VALIDATION");
  });

  test("exposes assumptions for incomplete target-state context", () => {
    const plan = compileNistCsfAiAssessment({
      organizationId: "ministry-ml",
      useCase: "target_state_profile",
      dataClassification: "internal",
      evidence: [
        { evidenceRef: "evidence://profile/1", kind: "current_profile", summary: "Validated current profile" },
        { evidenceRef: "evidence://nist/1", kind: "industry_reference", summary: "NIST CSF 2.0" },
        { evidenceRef: "evidence://requirement/1", kind: "requirement", summary: "National requirement" }
      ]
    });

    expect(plan.explicitAssumptions).toContain("MISSION_OBJECTIVES_NOT_PROVIDED");
    expect(plan.explicitAssumptions).toContain("RISK_LANDSCAPE_NOT_PROVIDED");
  });

  test("fails closed for controlled data without an approved provider", () => {
    expect(() => compileNistCsfAiAssessment({
      organizationId: "regulated-entity",
      useCase: "governance_review",
      dataClassification: "confidential",
      evidence: []
    })).toThrow(/CSF_AI_CONTROLLED_PROVIDER_REQUIRED/);
  });

  test("requires evidence references and summaries", () => {
    expect(() => compileNistCsfAiAssessment({
      organizationId: "entity",
      useCase: "current_state_profile",
      dataClassification: "public",
      evidence: [{ evidenceRef: "", kind: "artifact", summary: "Asset inventory" }]
    })).toThrow(/CSF_AI_EVIDENCE_REF_REQUIRED/);
  });

  test("keeps the official source and bounded truth state", () => {
    const plan = compileNistCsfAiAssessment({
      organizationId: "entity",
      useCase: "current_state_profile",
      dataClassification: "public",
      evidence: []
    });

    expect(NIST_CSF_AI_ASSESSMENT_ANCHOR.source).toBe("https://csrc.nist.gov/pubs/sp/1353/ipd");
    expect(plan.truthState).toBe("DRAFT_PLAN_ONLY");
    expect(plan.commentWindow.status).toBe("OPEN");
  });

  test("exposes the compiler through MCP and health", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("cyberaudit.csf_ai.compile"');
    expect(indexSource).toContain('"cyber:audit:compile"');
    expect(indexSource).toContain("nistCsfAiAssessmentPolicy");
  });
});
