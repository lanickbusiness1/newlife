import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  compileRepresentationArtifact,
  type RepresentationArtifactCompileRequest
} from "../src/representationArtifactCompiler";

const baseConstraints = {
  bandwidth: "low" as const,
  device: "mobile" as const,
  language: "fr"
};

describe("GEN-COMPILER-PROFILE-REPRESENTATION-001", () => {
  test("compiles a finance process into a timeline artifact with manifest lineage", () => {
    const result = compileRepresentationArtifact({
      representationRequest: {
        intent: "Expliquer le règlement PAPSS de bout en bout",
        domain: "finance",
        topic: "PAPSS settlement",
        objective: "understand_sequence",
        constraints: baseConstraints,
        signals: { sequential: true },
        evidenceRefs: ["evidence:papss-official-001"]
      },
      content: {
        title: "PAPSS — Flux de règlement",
        summary: "Vue pédagogique du flux fournie par les sources attachées.",
        steps: [
          { label: "Instruction", detail: "La banque initie l'instruction.", evidenceRefs: ["evidence:papss-official-001"] },
          { label: "Validation", detail: "Les contrôles applicables sont exécutés.", evidenceRefs: ["evidence:papss-official-001"] },
          { label: "Règlement", detail: "Le règlement suit la route autorisée.", evidenceRefs: ["evidence:papss-official-001"] }
        ]
      }
    });

    expect(result.resolution.primary.kind).toBe("timeline");
    expect(result.manifest.compilerProfileId).toBe("GEN-COMPILER-PROFILE-REPRESENTATION-001");
    expect(result.manifest.outputManifestRef).toBe("COMPILER-OUTPUT-MANIFEST-001");
    expect(result.manifest.selectedKind).toBe("timeline");
    expect(result.manifest.degraded).toBe(false);
    expect(result.manifest.evidenceRefs).toContain("evidence:papss-official-001");
    expect(result.html).toContain('data-representation-kind="timeline"');
    expect(result.html).toContain("PAPSS — Flux de règlement");
  });

  test("degrades a simulation request to diagram when no numeric interaction model is supplied", () => {
    const result = compileRepresentationArtifact({
      representationRequest: {
        intent: "Comprendre le cycle de Krebs",
        domain: "education",
        topic: "cycle de Krebs",
        objective: "understand_dynamic_process",
        learnerLevel: "secondary",
        constraints: baseConstraints,
        signals: { dynamicProcess: true },
        evidenceRefs: ["evidence:biology-001"]
      },
      content: {
        title: "Cycle de Krebs",
        summary: "Synthèse structurée des étapes fournies.",
        cards: [
          { title: "Entrée", body: "Acétyl-CoA", evidenceRefs: ["evidence:biology-001"] },
          { title: "Cycle", body: "Transformations successives", evidenceRefs: ["evidence:biology-001"] },
          { title: "Sorties", body: "Coenzymes réduits et CO₂", evidenceRefs: ["evidence:biology-001"] }
        ]
      }
    });

    expect(result.resolution.primary.kind).toBe("simulation");
    expect(result.manifest.selectedKind).toBe("diagram");
    expect(result.manifest.degraded).toBe(true);
    expect(result.manifest.degradedFrom).toBe("simulation");
    expect(result.manifest.degradationReason).toMatch(/INTERACTIVE_MODEL_REQUIRED/);
    expect(result.html).toContain('data-representation-kind="diagram"');
  });

  test("degrades calculator to chart for quantitative agriculture content without an explicit formula", () => {
    const result = compileRepresentationArtifact({
      representationRequest: {
        intent: "Comparer les postes de coût d'une campagne maïs",
        domain: "agriculture",
        topic: "budget maïs",
        objective: "compare_quantitative_scenarios",
        constraints: baseConstraints,
        signals: { quantitative: true, comparisonNeeded: true },
        evidenceRefs: ["evidence:maize-budget-001"]
      },
      content: {
        title: "Budget maïs — postes de coût",
        summary: "Comparaison des valeurs fournies.",
        metrics: [
          { label: "Semences", value: 120, unit: "kFCFA", evidenceRefs: ["evidence:maize-budget-001"] },
          { label: "Engrais", value: 260, unit: "kFCFA", evidenceRefs: ["evidence:maize-budget-001"] },
          { label: "Main-d'œuvre", value: 180, unit: "kFCFA", evidenceRefs: ["evidence:maize-budget-001"] }
        ]
      }
    });

    expect(result.resolution.primary.kind).toBe("calculator");
    expect(result.manifest.selectedKind).toBe("chart");
    expect(result.manifest.degradedFrom).toBe("calculator");
    expect(result.html).toContain('data-representation-kind="chart"');
    expect(result.html).toContain("Engrais");
  });

  test("compiles procedural enterprise content to sticky board", () => {
    const result = compileRepresentationArtifact({
      representationRequest: {
        intent: "Préparer une homologation API",
        domain: "enterprise",
        topic: "API homologation",
        objective: "execute_procedure",
        constraints: { ...baseConstraints, bandwidth: "offline" },
        signals: { procedural: true },
        evidenceRefs: ["evidence:api-procedure-001"]
      },
      content: {
        title: "Checklist homologation API",
        summary: "Étapes opératoires sourcées.",
        steps: [
          { label: "Contrat", detail: "Vérifier le contrat d'API.", evidenceRefs: ["evidence:api-procedure-001"] },
          { label: "Sécurité", detail: "Exécuter les contrôles de sécurité.", evidenceRefs: ["evidence:api-procedure-001"] }
        ]
      }
    });

    expect(result.manifest.selectedKind).toBe("sticky_board");
    expect(result.html).toContain('type="checkbox"');
    expect(result.html).toContain("Checklist homologation API");
  });

  test("compiles a bounded explicit numeric model to a simulation without eval", () => {
    const result = compileRepresentationArtifact({
      representationRequest: {
        intent: "Explorer un mécanisme à facteur limitant",
        domain: "education",
        topic: "facteur limitant",
        objective: "manipulate_causal_factors",
        learnerLevel: "secondary",
        constraints: baseConstraints,
        signals: { dynamicProcess: true, manipulationNeeded: true },
        evidenceRefs: ["evidence:model-001"]
      },
      content: {
        title: "Facteur limitant",
        summary: "Simulation pédagogique bornée.",
        interactiveModel: {
          operation: "min",
          outputLabel: "Taux",
          outputUnit: "%",
          variables: [
            { id: "factor_a", label: "Facteur A", min: 0, max: 100, step: 1, initial: 60, unit: "%" },
            { id: "factor_b", label: "Facteur B", min: 0, max: 100, step: 1, initial: 80, unit: "%" }
          ]
        }
      }
    });

    expect(result.manifest.selectedKind).toBe("simulation");
    expect(result.manifest.degraded).toBe(false);
    expect(result.html).toContain('data-operation="min"');
    expect(result.html).toContain('type="range"');
    expect(result.html).not.toContain("eval(");
  });

  test("escapes untrusted supplied content instead of executing HTML", () => {
    const result = compileRepresentationArtifact({
      representationRequest: {
        intent: "Résumer un contenu",
        domain: "general",
        objective: "summarize",
        constraints: baseConstraints,
        evidenceRefs: ["evidence:safe-001"]
      },
      content: {
        title: "<script>alert('x')</script>",
        summary: "<img src=x onerror=alert(1)>",
        cards: [
          { title: "<b>unsafe</b>", body: "<script>boom()</script>", evidenceRefs: ["evidence:safe-001"] }
        ]
      }
    });

    expect(result.html).not.toContain("<script>alert('x')</script>");
    expect(result.html).not.toContain("<img src=x");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("&lt;img");
  });

  test("fails closed when content has no evidence lineage", () => {
    expect(() => compileRepresentationArtifact({
      representationRequest: {
        intent: "Résumé",
        domain: "general",
        objective: "summarize",
        constraints: baseConstraints,
        evidenceRefs: ["evidence:top-level"]
      },
      content: {
        title: "Orphan claim",
        summary: "No item evidence",
        cards: [
          { title: "Claim", body: "Unsourced", evidenceRefs: [] }
        ]
      }
    })).toThrow(/REPRESENTATION_ARTIFACT_EVIDENCE_REQUIRED/);
  });

  test("produces deterministic manifest and artifact digests for identical input", () => {
    const request: RepresentationArtifactCompileRequest = {
      representationRequest: {
        intent: "Présenter les composantes d'une biosphère",
        domain: "education",
        topic: "biosphère",
        objective: "synthesize",
        learnerLevel: "secondary",
        constraints: baseConstraints,
        evidenceRefs: ["evidence:biosphere-001"]
      },
      content: {
        title: "Biosphère",
        summary: "Synthèse des composantes fournies.",
        cards: [
          { title: "Atmosphère", body: "Couche gazeuse.", evidenceRefs: ["evidence:biosphere-001"] },
          { title: "Hydrosphère", body: "Eaux de la planète.", evidenceRefs: ["evidence:biosphere-001"] }
        ]
      }
    };

    const first = compileRepresentationArtifact(request);
    const second = compileRepresentationArtifact(request);

    expect(first.manifest.contentDigest).toBe(second.manifest.contentDigest);
    expect(first.manifest.artifactDigest).toBe(second.manifest.artifactDigest);
    expect(first.manifest.manifestDigest).toBe(second.manifest.manifestDigest);
    expect(first.manifest.artifactId).toBe(second.manifest.artifactId);
  });

  test("exposes compilation through a governed MCP scope", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("representation.artifact.compile"');
    expect(indexSource).toContain('"representation:compile"');
  });
});
