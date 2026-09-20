import { describe, expect, test } from "vitest";
import {
  GENESIS_PIPELINE_STAGE_PROFILES,
  recommendCreationCapabilities
} from "../src/openAICapabilityRegistry";

describe("V4-DEC-042A Cross-Pipeline Auto Representation", () => {
  test("defines a profile for every canonical GENESIS creation stage", () => {
    const ids = GENESIS_PIPELINE_STAGE_PROFILES.map(item => item.stage);
    expect(ids).toEqual(expect.arrayContaining([
      "signal",
      "goir",
      "eces",
      "requirements",
      "blueprint",
      "master_prompt",
      "build",
      "controls",
      "deployment",
      "marketing",
      "sales",
      "revenue",
      "measurement_reme"
    ]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("routes Signal stage to evidence-first representation", () => {
    const result = recommendCreationCapabilities({
      intent: "Qualifier ce signal",
      objective: "qualify_signal",
      domain: "general",
      stage: "signal",
      signals: {}
    });

    expect(result.primaryRecipe.id).toBe("evidence_panel");
    expect(result.stageProfile?.stage).toBe("signal");
    expect(result.stageProfile?.recommendedRecipes).toEqual(
      expect.arrayContaining(["evidence_panel", "timeline"])
    );
  });

  test("routes GOIR to decision and comparison representations", () => {
    const result = recommendCreationCapabilities({
      intent: "Évaluer cette opportunité",
      objective: "opportunity_decision",
      domain: "enterprise",
      stage: "goir",
      signals: {}
    });

    expect(["comparison_matrix", "decision_tree"]).toContain(result.primaryRecipe.id);
    expect(result.stageProfile?.recommendedRecipes).toEqual(
      expect.arrayContaining(["comparison_matrix", "decision_tree"])
    );
  });

  test("routes ECES to economic dashboard/calculator representations", () => {
    const result = recommendCreationCapabilities({
      intent: "Évaluer la viabilité économique",
      objective: "economic_viability",
      domain: "finance",
      stage: "eces",
      signals: { quantitative: true }
    });

    expect(["dashboard", "calculator", "chart_pack"]).toContain(result.primaryRecipe.id);
    expect(result.stageProfile?.recommendedRecipes).toEqual(
      expect.arrayContaining(["dashboard", "calculator"])
    );
  });

  test("routes requirements and blueprint stages to documents plus diagrams", () => {
    const requirements = recommendCreationCapabilities({
      intent: "Compiler le cahier des charges",
      objective: "requirements_spec",
      domain: "enterprise",
      stage: "requirements",
      signals: {}
    });
    expect(requirements.primaryRecipe.id).toBe("editable_document");
    expect(requirements.stageProfile?.recommendedRecipes).toEqual(
      expect.arrayContaining(["editable_document", "process_map", "structured_json"])
    );

    const blueprint = recommendCreationCapabilities({
      intent: "Construire le blueprint d'architecture",
      objective: "architecture_blueprint",
      domain: "enterprise",
      stage: "blueprint",
      signals: {}
    });
    expect(["flowchart", "annotated_diagram", "process_map"]).toContain(blueprint.primaryRecipe.id);
  });

  test("routes Build to executable prototype/code-oriented recipes", () => {
    const result = recommendCreationCapabilities({
      intent: "Construire et prévisualiser le produit",
      objective: "build",
      domain: "enterprise",
      stage: "build",
      signals: { codePrototype: true, interactiveUi: true }
    });

    expect(["prototype_react", "prototype_html"]).toContain(result.primaryRecipe.id);
    expect(result.stageProfile?.recommendedRecipes).toEqual(
      expect.arrayContaining(["prototype_react", "prototype_html", "coding_patch"])
    );
  });

  test("routes controls to checklist and evidence representations", () => {
    const result = recommendCreationCapabilities({
      intent: "Fermer M8 et Big4 avec preuves",
      objective: "gate_review",
      domain: "enterprise",
      stage: "controls",
      signals: { checklist: true }
    });

    expect(["action_checklist", "sticky_board", "evidence_panel"]).toContain(result.primaryRecipe.id);
    expect(result.stageProfile?.recommendedRecipes).toEqual(
      expect.arrayContaining(["action_checklist", "evidence_panel"])
    );
  });

  test("routes marketing, sales and revenue to their stage-native artifact packs", () => {
    const marketing = recommendCreationCapabilities({
      intent: "Préparer les assets de lancement",
      objective: "market_launch",
      domain: "enterprise",
      stage: "marketing",
      signals: {}
    });
    expect(["one_pager", "infographic", "poster"]).toContain(marketing.primaryRecipe.id);

    const sales = recommendCreationCapabilities({
      intent: "Préparer la vente",
      objective: "sales_close",
      domain: "enterprise",
      stage: "sales",
      signals: {}
    });
    expect(["executive_brief", "comparison_matrix", "calculator"]).toContain(sales.primaryRecipe.id);

    const revenue = recommendCreationCapabilities({
      intent: "Piloter les revenus",
      objective: "revenue_management",
      domain: "finance",
      stage: "revenue",
      signals: { quantitative: true }
    });
    expect(["dashboard", "chart_pack", "data_story"]).toContain(revenue.primaryRecipe.id);
  });

  test("routes R.E.M.E measurement to outcome analytics artifacts", () => {
    const result = recommendCreationCapabilities({
      intent: "Mesurer les résultats et apprendre",
      objective: "measure_learn",
      domain: "general",
      stage: "measurement_reme",
      signals: { dataAnalysis: true }
    });

    expect(["data_story", "dashboard", "chart_pack", "evidence_panel"]).toContain(result.primaryRecipe.id);
    expect(result.stageProfile?.stage).toBe("measurement_reme");
  });
});
