import { describe, expect, test } from "vitest";
import { exportEvidenceJson, exportHtmlReport, exportMarketingPlanMarkdown } from "./exporters";

const payload = {
  productName: "AfrIA Marketing Team™",
  assetId: "PRD-MKT-TEAM-001",
  offer: "Starter Revenue Engine",
  productionRevenueReady: false
};

describe("export engine", () => {
  test("exports a Markdown plan with canonical anchors", () => {
    const md = exportMarketingPlanMarkdown(payload);
    expect(md).toContain("AfrIA Marketing Team™");
    expect(md).toContain("PRD-MKT-TEAM-001");
    expect(md).toContain("Production Product");
  });

  test("exports JSON evidence with revenue readiness false", () => {
    const json = JSON.parse(exportEvidenceJson(payload));
    expect(json.productionRevenueReady).toBe(false);
  });

  test("exports an HTML report without white default framing", () => {
    const html = exportHtmlReport(payload);
    expect(html).toContain("background");
    expect(html).toContain("#120907");
  });
});
