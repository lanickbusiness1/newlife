import { describe, expect, test } from "vitest";
import { AGENTS, generateLeadEnginePlan, runAgent } from "./agents";

const context = {
  productName: "AfrIA Marketing Team™",
  country: "Bénin",
  buyer: "CEO PME",
  offer: "Starter Revenue Engine",
  price: "49 900 FCFA"
};

describe("production agents", () => {
  test("contains the five canonical agents", () => {
    expect(AGENTS.map(agent => agent.id)).toEqual(["strategist", "creator", "designer", "analyst", "cmo"]);
  });

  test("runs each agent with product context", () => {
    expect(runAgent("strategist", context)).toContain("GTM");
    expect(runAgent("creator", context)).toContain("WhatsApp");
    expect(runAgent("designer", context)).toContain("brief visuel");
    expect(runAgent("analyst", context)).toContain("marché");
    expect(runAgent("cmo", context)).toContain("30/60/90");
  });

  test("generates ICP, scripts and sequence through LeadEngine", () => {
    const plan = generateLeadEnginePlan(context);
    expect(plan.icp).toContain("CEO PME");
    expect(plan.script).toContain("AfrIA Marketing Team™");
    expect(plan.sequence).toHaveLength(6);
  });
});
