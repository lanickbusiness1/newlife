import { describe, expect, test } from "vitest";
import {
  compileIndustrialDependencyReadiness,
  INDUSTRIAL_DEPENDENCY_CATEGORIES
} from "../src/industrialDependencyAdapter";

function completeDependencies() {
  return INDUSTRIAL_DEPENDENCY_CATEGORIES.map(category => ({
    category,
    critical: ["raw_material", "power", "water", "financing", "regulation", "logistics", "buyers"].includes(category),
    status: "VERIFIED" as const,
    evidenceRefs: [`reme://industrial/${category}/proof`]
  }));
}

describe("V4-DEC-036 Industrial Dependency Readiness Adapter", () => {
  test("returns VERIFIED only when the complete dependency graph is explicitly resolved", () => {
    const result = compileIndustrialDependencyReadiness({ dependencies: completeDependencies() });

    expect(result.readiness).toBe("VERIFIED");
    expect(result.missingCategories).toEqual([]);
    expect(result.blockers).toEqual([]);
    expect(result.canFeedDeliveryGate).toBe(true);
  });

  test("fails closed when a critical dependency is blocked", () => {
    const dependencies = completeDependencies().map(item =>
      item.category === "power" ? { ...item, status: "BLOCKED" as const } : item
    );
    const result = compileIndustrialDependencyReadiness({ dependencies });

    expect(result.readiness).toBe("BLOCKED");
    expect(result.canFeedDeliveryGate).toBe(false);
    expect(result.blockers).toContain("CRITICAL_DEPENDENCY_BLOCKED:power");
  });

  test("treats a missing dependency category as UNKNOWN instead of silently assuming availability", () => {
    const dependencies = completeDependencies().filter(item => item.category !== "port");
    const result = compileIndustrialDependencyReadiness({ dependencies });

    expect(result.readiness).toBe("UNKNOWN");
    expect(result.missingCategories).toContain("port");
    expect(result.canFeedDeliveryGate).toBe(false);
  });

  test("allows explicit NOT_APPLICABLE only with justification and evidence", () => {
    const dependencies = completeDependencies().map(item =>
      item.category === "rail"
        ? {
            ...item,
            critical: false,
            status: "NOT_APPLICABLE_JUSTIFIED" as const,
            justification: "No rail interface exists in the bounded pilot logistics design.",
            evidenceRefs: ["reme://industrial/rail/not-applicable-design-proof"]
          }
        : item
    );
    const result = compileIndustrialDependencyReadiness({ dependencies });

    expect(result.readiness).toBe("VERIFIED");
    expect(result.blockers).toEqual([]);
  });

  test("returns INVALID_INPUT on malformed payload", () => {
    const result = compileIndustrialDependencyReadiness(null);
    expect(result.readiness).toBe("INVALID_INPUT");
    expect(result.canFeedDeliveryGate).toBe(false);
  });
});
