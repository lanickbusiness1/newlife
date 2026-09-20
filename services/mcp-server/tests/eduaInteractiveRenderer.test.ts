import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  computePhotosynthesisRate,
  evaluateLearningOutcome,
  renderPhotosynthesisArtifact
} from "../src/eduaInteractiveRenderer";

describe("EDUA interactive photosynthesis artifact", () => {
  test("computes a bounded rate using the limiting-factor rule", () => {
    expect(computePhotosynthesisRate({ light: 100, co2: 100, water: 100 })).toBe(100);
    expect(computePhotosynthesisRate({ light: 80, co2: 40, water: 90 })).toBe(40);
    expect(computePhotosynthesisRate({ light: 25, co2: 90, water: 90 })).toBe(25);
  });

  test("rejects invalid environmental inputs", () => {
    expect(() => computePhotosynthesisRate({ light: -1, co2: 50, water: 50 })).toThrow(/EDUA_PHOTOSYNTHESIS_INVALID_LIGHT/);
    expect(() => computePhotosynthesisRate({ light: 50, co2: 101, water: 50 })).toThrow(/EDUA_PHOTOSYNTHESIS_INVALID_CO2/);
  });

  test("renders a self-contained low-bandwidth interactive artifact", () => {
    const html = renderPhotosynthesisArtifact({
      language: "fr",
      learnerLevel: "secondary",
      representationEventId: "repr-demo-001"
    });

    expect(html).toContain('id="light"');
    expect(html).toContain('id="co2"');
    expect(html).toContain('id="water"');
    expect(html).toContain('id="photosynthesis-rate"');
    expect(html).toContain('id="quiz-form"');
    expect(html).toContain('id="pre-score"');
    expect(html).toContain('id="post-score"');
    expect(html).toContain("repr-demo-001");
    expect(html).toContain('fetch("/api/edua/outcome"');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html.length).toBeLessThan(60000);
  });

  test("measures comprehension delta and emits a bounded R.E.M.E candidate", () => {
    const outcome = evaluateLearningOutcome({
      learnerSessionId: "anonymous-session-001",
      representationEventId: "repr-demo-001",
      preScore: 40,
      postScore: 80,
      interactions: 6,
      evidenceRefs: ["evidence:quiz-001"]
    });

    expect(outcome.comprehensionDelta).toBe(40);
    expect(outcome.masteryStatus).toBe("improved");
    expect(outcome.remeCandidate.status).toBe("candidate_only");
    expect(outcome.remeCandidate.requiresGateReview).toBe(true);
    expect(outcome.evidenceRefs).toContain("evidence:quiz-001");
  });

  test("does not overclaim mastery when improvement is small", () => {
    const outcome = evaluateLearningOutcome({
      learnerSessionId: "anonymous-session-002",
      representationEventId: "repr-demo-002",
      preScore: 70,
      postScore: 74,
      interactions: 2,
      evidenceRefs: ["evidence:quiz-002"]
    });

    expect(outcome.masteryStatus).toBe("stable");
    expect(outcome.claim).toBe("MEASURED_SESSION_OUTCOME_ONLY");
  });

  test("keeps an immutable static fallback aligned with the governed artifact", () => {
    const staticHtml = readFileSync(
      new URL("../../../apps/edua-os/demos/photosynthesis.html", import.meta.url),
      "utf8"
    );

    expect(staticHtml).toContain("EDUA-ART-PHOTOSYNTHESIS-001");
    expect(staticHtml).toContain('id="photosynthesis-rate"');
    expect(staticHtml).toContain("candidate_only");
    expect(staticHtml).toContain("MEASURED_SESSION_OUTCOME_ONLY");
    expect(staticHtml).toContain('data-truth-state="STATIC_DEMO"');
    expect(staticHtml).not.toMatch(/https?:\/\//);
  });

  test("ships the five-mode EDUA Representation Lab without external dependencies", () => {
    const labHtml = readFileSync(
      new URL("../../../apps/edua-os/demos/representation-lab.html", import.meta.url),
      "utf8"
    );

    expect(labHtml).toContain("EDUA-REPRESENTATION-LAB-001");
    expect(labHtml).toContain('data-mode="visualize_learning"');
    expect(labHtml).toContain('data-mode="handwritten_note"');
    expect(labHtml).toContain('data-mode="sticky_board"');
    expect(labHtml).toContain('data-mode="info_chart"');
    expect(labHtml).toContain('data-mode="infograph"');
    expect(labHtml).not.toMatch(/https?:\/\//);
  });

  test("exposes a public demo route and governed outcome tool", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('app.get("/demo/edua/photosynthesis"');
    expect(indexSource).toContain('register("edua.learning.evaluate_outcome"');
    expect(indexSource).toContain('"education:measure"');
  });
});
