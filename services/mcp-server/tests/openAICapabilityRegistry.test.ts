import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  GENESIS_CREATION_RECIPE_REGISTRY,
  OPENAI_CAPABILITY_REGISTRY,
  recommendCreationCapabilities
} from "../src/openAICapabilityRegistry";

describe("V4-DEC-042 OpenAI Capability & Representation Registry", () => {
  test("contains a broad, versioned primitive capability library with no duplicate IDs", () => {
    const ids = OPENAI_CAPABILITY_REGISTRY.map(item => item.id);
    expect(ids.length).toBeGreaterThanOrEqual(35);
    expect(new Set(ids).size).toBe(ids.length);

    const required = [
      "writing_block",
      "code_block",
      "html_preview",
      "react_preview",
      "svg_preview",
      "mermaid_preview",
      "vega_preview",
      "interactive_chart",
      "structured_output_json_schema",
      "image_generation",
      "image_edit",
      "vision_image_understanding",
      "video_generation",
      "video_remix",
      "text_to_speech",
      "speech_to_text",
      "speaker_diarization",
      "realtime_speech_to_speech",
      "realtime_translation",
      "file_pdf_understanding",
      "web_search",
      "file_search",
      "deep_research",
      "code_interpreter",
      "computer_use",
      "function_calling",
      "remote_mcp",
      "connected_apps",
      "moderation_text_image",
      "evals_graders",
      "embeddings_vector_search"
    ];

    for (const id of required) expect(ids).toContain(id);
  });

  test("all GENESIS recipes reference only registered primitive capabilities", () => {
    const capabilityIds = new Set(OPENAI_CAPABILITY_REGISTRY.map(item => item.id));
    for (const recipe of GENESIS_CREATION_RECIPE_REGISTRY) {
      for (const id of [
        ...recipe.requiredCapabilities,
        ...(recipe.optionalCapabilities ?? [])
      ]) {
        expect(capabilityIds.has(id), `${recipe.id} references unknown capability ${id}`).toBe(true);
      }
    }
  });

  test("contains a broad GENESIS recipe library beyond the five seed examples", () => {
    const ids = GENESIS_CREATION_RECIPE_REGISTRY.map(item => item.id);
    expect(ids.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ids).size).toBe(ids.length);

    for (const id of [
      "visualize_learning",
      "handwritten_note",
      "sticky_board",
      "info_chart",
      "infographic",
      "concept_map",
      "mind_map",
      "flowchart",
      "timeline",
      "decision_tree",
      "comparison_matrix",
      "flashcards",
      "quiz",
      "annotated_diagram",
      "storyboard",
      "interactive_simulation",
      "calculator",
      "dashboard",
      "prototype_html",
      "prototype_react",
      "voice_explainer",
      "video_explainer",
      "research_report",
      "meeting_digest",
      "structured_json"
    ]) {
      expect(ids).toContain(id);
    }
  });

  test("routes photosynthesis to Visualize Learning with auto-render confidence", () => {
    const result = recommendCreationCapabilities({
      intent: "Je veux comprendre en détail comment fonctionne la photosynthèse",
      objective: "understand_dynamic_process",
      domain: "education",
      signals: {
        dynamicProcess: true,
        causal: true,
        educational: true,
        interactionHelpful: true
      }
    });

    expect(result.primaryRecipe.id).toBe("visualize_learning");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.policy).toBe("AUTO_RENDER");
    expect(result.primitiveCapabilities.map(item => item.id)).toEqual(
      expect.arrayContaining(["html_preview", "code_block"])
    );
  });

  test("routes Archimedes note intent to handwritten note while preserving simulation as an alternative", () => {
    const result = recommendCreationCapabilities({
      intent: "Fais-moi une note de la poussée d'Archimède comme si elle était écrite à la main",
      objective: "memorize_concept",
      domain: "education",
      signals: {
        educational: true,
        memorization: true,
        handwrittenRequested: true,
        dynamicProcess: true
      }
    });

    expect(result.primaryRecipe.id).toBe("handwritten_note");
    expect(result.alternativeRecipes.map(item => item.id)).toContain("interactive_simulation");
    expect(result.primitiveCapabilities.map(item => item.id)).toContain("image_generation");
  });

  test("routes procedural checklist intent to sticky board", () => {
    const result = recommendCreationCapabilities({
      intent: "Donne-moi une checklist visuelle de toutes les étapes",
      objective: "execute_procedure",
      domain: "enterprise",
      signals: {
        procedural: true,
        checklist: true,
        visual: true
      }
    });

    expect(result.primaryRecipe.id).toBe("sticky_board");
  });

  test("routes BMI-style threshold comparison to info chart without implying personalized medical advice", () => {
    const result = recommendCreationCapabilities({
      intent: "Montre-moi les catégories de l'IMC sous forme visuelle",
      objective: "compare_thresholds",
      domain: "health",
      signals: {
        quantitative: true,
        thresholds: true,
        comparative: true,
        visual: true
      }
    });

    expect(result.primaryRecipe.id).toBe("info_chart");
    expect(result.guardrails).toContain("HEALTH_CONTEXT_REQUIRES_NON_DIAGNOSTIC_BOUNDARY");
  });

  test("routes biosphere structure to infographic and concept map alternatives", () => {
    const result = recommendCreationCapabilities({
      intent: "Explique la biosphère et ses grandes composantes",
      objective: "synthesize_system",
      domain: "education",
      signals: {
        hierarchical: true,
        ecosystem: true,
        educational: true,
        visual: true
      }
    });

    expect(result.primaryRecipe.id).toBe("infographic");
    expect(result.alternativeRecipes.map(item => item.id)).toEqual(
      expect.arrayContaining(["concept_map", "mind_map"])
    );
  });

  test("routes current multi-source research to deep research and a research report", () => {
    const result = recommendCreationCapabilities({
      intent: "Compare les dernières approches avec plusieurs sources et citations",
      objective: "research_compare",
      domain: "general",
      signals: {
        currentInformation: true,
        multiSourceResearch: true,
        citationsRequired: true
      }
    });

    expect(result.primaryRecipe.id).toBe("research_report");
    expect(result.primitiveCapabilities.map(item => item.id)).toEqual(
      expect.arrayContaining(["deep_research", "web_search"])
    );
  });

  test("routes internal-document research to file search", () => {
    const result = recommendCreationCapabilities({
      intent: "Analyse mes documents internes et synthétise les preuves",
      objective: "internal_research",
      domain: "enterprise",
      signals: {
        internalFiles: true,
        citationsRequired: true
      }
    });

    expect(result.primitiveCapabilities.map(item => item.id)).toContain("file_search");
  });

  test("routes executable prototype requests to React or HTML previews", () => {
    const result = recommendCreationCapabilities({
      intent: "Construis un mini prototype interactif de cette interface",
      objective: "prototype_ui",
      domain: "enterprise",
      signals: {
        codePrototype: true,
        interactiveUi: true
      }
    });

    expect(["prototype_react", "prototype_html"]).toContain(result.primaryRecipe.id);
    expect(result.primitiveCapabilities.map(item => item.id)).toEqual(
      expect.arrayContaining(["code_block", "react_preview", "html_preview"])
    );
  });

  test("routes machine-readable contracts to Structured Outputs", () => {
    const result = recommendCreationCapabilities({
      intent: "Retourne un contrat JSON strict pour mon API",
      objective: "machine_contract",
      domain: "enterprise",
      signals: {
        machineReadable: true,
        strictSchema: true
      }
    });

    expect(result.primaryRecipe.id).toBe("structured_json");
    expect(result.primitiveCapabilities.map(item => item.id)).toContain("structured_output_json_schema");
  });

  test("routes meeting audio to transcription, diarization and meeting digest", () => {
    const result = recommendCreationCapabilities({
      intent: "Transcris cette réunion, identifie les intervenants et sors les actions",
      objective: "meeting_digest",
      domain: "enterprise",
      signals: {
        audioInput: true,
        multiSpeaker: true,
        actionItems: true
      }
    });

    expect(result.primaryRecipe.id).toBe("meeting_digest");
    expect(result.primitiveCapabilities.map(item => item.id)).toEqual(
      expect.arrayContaining(["speech_to_text", "speaker_diarization"])
    );
  });

  test("routes live multilingual conversation to realtime translation", () => {
    const result = recommendCreationCapabilities({
      intent: "Conversation vocale en direct avec traduction",
      objective: "live_translate",
      domain: "general",
      signals: {
        realtime: true,
        audioInput: true,
        audioOutput: true,
        translation: true
      }
    });

    expect(result.primitiveCapabilities.map(item => item.id)).toEqual(
      expect.arrayContaining(["realtime_speech_to_speech", "realtime_translation"])
    );
  });

  test("routes external-system mutations to action-gated capabilities", () => {
    const result = recommendCreationCapabilities({
      intent: "Mets à jour mon CRM et envoie les changements",
      objective: "external_action",
      domain: "enterprise",
      signals: {
        externalSystemAction: true,
        mutation: true
      }
    });

    expect(result.policy).toBe("ACTION_GATED");
    expect(result.primitiveCapabilities.map(item => item.id)).toEqual(
      expect.arrayContaining(["function_calling", "remote_mcp", "connected_apps"])
    );
  });

  test("exposes automatic capability recommendation through the governed MCP", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    expect(indexSource).toContain('register("representation.capabilities.recommend"');
    expect(indexSource).toContain('"representation:capabilities:recommend"');
  });
});
