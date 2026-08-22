import { describe, expect, it } from "vitest";
import { assessEnterpriseVisibility, type VisibilityAssessment } from "./visibility";

const fullVisibility: VisibilityAssessment = {
  enterpriseName: "Example SA",
  country: "Bénin",
  verifiedIdentity: true,
  verifiedSourceCount: 5,
  websitePresent: true,
  searchPresence: 100,
  aiPresence: 100,
  mediaPresence: 100,
  professionalPresence: 100,
  marketplacePresence: 100,
  institutionalPresence: 100,
  investorPresence: 100
};

describe("African Enterprise Visibility Gap™", () => {
  it("returns zero gap for a fully visible enterprise", () => {
    const result = assessEnterpriseVisibility(fullVisibility);
    expect(result.visibilityScore).toBe(100);
    expect(result.visibilityGap).toBe(0);
    expect(result.priority).toBe("low");
    expect(result.confidence).toBe("high");
  });

  it("marks unknown observations instead of inventing them", () => {
    const result = assessEnterpriseVisibility({
      enterpriseName: "Invisible SARL",
      country: "Mali",
      verifiedIdentity: true,
      verifiedSourceCount: 1,
      websitePresent: false
    });
    expect(result.missingDimensions).toContain("searchPresence");
    expect(result.missingDataPolicy).toBe("mark_missing_never_invent");
    expect(result.confidence).toBe("low");
    expect(result.visibilityGap).toBeGreaterThanOrEqual(70);
  });

  it("prioritizes actions on the weakest channels", () => {
    const result = assessEnterpriseVisibility({ ...fullVisibility, aiPresence: 15, marketplacePresence: 20 });
    expect(result.recommendedActions.some(action => action.includes("IA"))).toBe(true);
    expect(result.recommendedActions.some(action => action.toLowerCase().includes("marketplace"))).toBe(true);
  });
});
