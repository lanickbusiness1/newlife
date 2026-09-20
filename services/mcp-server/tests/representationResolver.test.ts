import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  adaptEduaRepresentation,
  resolveRepresentation,
  type RepresentationRequest
} from "../src/representationResolver";

const educationProcess: RepresentationRequest = {
  intent: "Comprendre comment fonctionne la photosynthèse",
  domain: "education",
  topic: "photosynthèse",
  objective: "understand_process",
  learnerLevel: "secondary",
  constraints: {
    bandwidth: "low",
    device: "mobile",
    language: "fr"
  },
  signals: {
    dynamicProcess: true,
    assessmentNeeded: true
  },
  evidenceRefs: ["notion:V4-DEC-042", "notion:EDUA-V2"]
};

describe("V4-DEC-042 Generative Interaction & Representation Layer", () => {
  test("routes an EDUA dynamic concept to interactive simulation plus assessment", () => {
    const result = resolveRepresentation(educationProcess);

    expect(result.primary.kind).toBe("simulation");
    expect(result.composition.map(item => item.kind)).toContain("quiz");
    expect(result.domain).toBe("education");
    expect(result.truthState).toBe("DESIGN_SELECTION_ONLY");
  });

  test("applies low-bandwidth policy without losing pedagogical intent", () => {
    const result = resolveRepresentation({
      ...educationProcess,
      signals: {
        ...educationProcess.signals,
        richMediaHelpful: true
      }
    });

    expect(result.composition.map(item => item.kind)).not.toContain("video_animation");
    expect(result.constraintsApplied).toContain("LOW_BANDWIDTH_POLICY");
    expect(result.primary.kind).toBe("simulation");
  });

  test("routes quantitative decision support to calculator and chart", () => {
    const result = resolveRepresentation({
      intent: "Simuler la rentabilité de 6000 pondeuses",
      domain: "agriculture",
      topic: "rentabilité élevage",
      objective: "compare_quantitative_scenarios",
      constraints: {
        bandwidth: "normal",
        device: "desktop",
        language: "fr"
      },
      signals: {
        quantitative: true,
        comparisonNeeded: true,
        manipulationNeeded: true
      },
      evidenceRefs: ["evidence:farm-inputs"]
    });

    const kinds = result.composition.map(item => item.kind);
    expect(kinds[0]).toBe("calculator");
    expect(kinds).toContain("chart");
    expect(kinds).toContain("dashboard");
  });

  test("routes procedural work to sticky-board/checklist representation", () => {
    const result = resolveRepresentation({
      intent: "Donne-moi la checklist pour homologuer une API",
      domain: "enterprise",
      topic: "API homologation",
      objective: "execute_procedure",
      constraints: {
        bandwidth: "offline",
        device: "mobile",
        language: "fr"
      },
      signals: {
        procedural: true,
        assessmentNeeded: false
      },
      evidenceRefs: ["evidence:procedure"]
    });

    expect(result.primary.kind).toBe("sticky_board");
    expect(result.composition.map(item => item.kind)).toContain("text");
  });

  test("creates governed telemetry and a bounded R.E.M.E candidate", () => {
    const result = resolveRepresentation(educationProcess);

    expect(result.telemetry.eventType).toBe("representation.selected");
    expect(result.telemetry.eventId).toMatch(/^repr-/);
    expect(result.telemetry.evidenceRefs).toEqual(expect.arrayContaining(["notion:V4-DEC-042"]));
    expect(result.remeCandidate.status).toBe("candidate_only");
    expect(result.remeCandidate.requiresGateReview).toBe(true);
    expect(result.remeCandidate.measurementPlan).toContain("task_completion");
  });

  test("EDUA adapter preserves mastery as the north-star outcome", () => {
    const adapted = adaptEduaRepresentation({
      concept: "photosynthèse",
      learnerLevel: "secondary",
      learningObjective: "understand_process",
      constraints: {
        bandwidth: "low",
        device: "mobile",
        language: "fr"
      },
      signals: {
        dynamicProcess: true,
        assessmentNeeded: true
      },
      evidenceRefs: ["notion:V4-DEC-042"]
    });

    expect(adapted.northStar).toBe("measured_comprehension");
    expect(adapted.representation.primary.kind).toBe("simulation");
    expect(adapted.masteryLoop).toEqual([
      "understand",
      "represent",
      "interact",
      "test",
      "diagnose",
      "re_explain",
      "measure_mastery",
      "adapt"
    ]);
  });

  test("fails closed on incomplete requests", () => {
    expect(() => resolveRepresentation({
      ...educationProcess,
      objective: ""
    })).toThrow(/REPRESENTATION_INVALID_OBJECTIVE/);
  });

  test("exposes the resolver through a governed MCP scope", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("representation.resolve"');
    expect(indexSource).toContain('"representation:resolve"');
    expect(indexSource).toContain('register("edua.representation.resolve"');
    expect(indexSource).toContain('"education:represent"');
  });
});
