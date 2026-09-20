import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  compileRepresentationFromEvidence,
  type RepresentationEvidenceCompileRequest
} from "../src/representationEvidenceAdapter";

const constraints = {
  bandwidth: "low" as const,
  device: "mobile" as const,
  language: "fr"
};

describe("V4-DEC-042 Evidence-to-Content Adapter", () => {
  test("turns PAPSS step evidence into a timeline artifact without manual content modeling", () => {
    const result = compileRepresentationFromEvidence({
      topic: "PAPSS — règlement transfrontalier",
      domain: "finance",
      objective: "understand_sequence",
      constraints,
      evidencePacket: {
        summary: "Séquence reconstruite uniquement à partir des preuves fournies.",
        items: [
          { evidenceRef: "ev:papss:1", kind: "step", label: "Instruction", claim: "Une instruction de paiement est initiée.", sequence: 1 },
          { evidenceRef: "ev:papss:2", kind: "step", label: "Contrôles", claim: "Les contrôles applicables sont exécutés.", sequence: 2 },
          { evidenceRef: "ev:papss:3", kind: "step", label: "Règlement", claim: "Le règlement suit la route autorisée.", sequence: 3 }
        ]
      }
    });

    expect(result.inferredSignals.sequential).toBe(true);
    expect(result.content.steps).toHaveLength(3);
    expect(result.compilation.manifest.selectedKind).toBe("timeline");
    expect(result.compilation.html).toContain("Instruction");
    expect(result.truthState).toBe("COMPILED_FROM_SUPPLIED_EVIDENCE");
  });

  test("turns Mali budget metrics into a chart artifact", () => {
    const result = compileRepresentationFromEvidence({
      topic: "Budget Mali — allocation simplifiée",
      domain: "government",
      objective: "compare_quantitative_scenarios",
      constraints,
      evidencePacket: {
        items: [
          { evidenceRef: "ev:mali:1", kind: "metric", label: "Éducation", claim: "Allocation fournie.", value: 420, unit: "Mds FCFA" },
          { evidenceRef: "ev:mali:2", kind: "metric", label: "Santé", claim: "Allocation fournie.", value: 310, unit: "Mds FCFA" },
          { evidenceRef: "ev:mali:3", kind: "metric", label: "Agriculture", claim: "Allocation fournie.", value: 180, unit: "Mds FCFA" }
        ]
      }
    });

    expect(result.inferredSignals.quantitative).toBe(true);
    expect(result.content.metrics).toHaveLength(3);
    expect(["chart", "dashboard"]).toContain(result.compilation.manifest.selectedKind);
    expect(result.compilation.html).toContain("Mds FCFA");
  });

  test("does not invent a maize formula when only cost metrics are supplied", () => {
    const result = compileRepresentationFromEvidence({
      topic: "Culture du maïs — coûts",
      domain: "agriculture",
      objective: "compare_quantitative_scenarios",
      constraints,
      evidencePacket: {
        items: [
          { evidenceRef: "ev:maize:1", kind: "metric", label: "Semences", claim: "Coût documenté.", value: 100, unit: "kFCFA" },
          { evidenceRef: "ev:maize:2", kind: "metric", label: "Engrais", claim: "Coût documenté.", value: 250, unit: "kFCFA" }
        ]
      }
    });

    expect(result.content.interactiveModel).toBeUndefined();
    expect(result.compilation.manifest.requestedPrimaryKind).toBe("calculator");
    expect(result.compilation.manifest.selectedKind).toBe("chart");
    expect(result.compilation.manifest.degraded).toBe(true);
  });

  test("turns Krebs ordered evidence into a timeline/diagram without inventing biochemical details", () => {
    const result = compileRepresentationFromEvidence({
      topic: "Cycle de Krebs",
      domain: "education",
      objective: "understand_process",
      learnerLevel: "secondary",
      constraints,
      evidencePacket: {
        items: [
          { evidenceRef: "ev:krebs:1", kind: "step", label: "Entrée", claim: "L'entrée documentée est Acétyl-CoA.", sequence: 1 },
          { evidenceRef: "ev:krebs:2", kind: "step", label: "Transformations", claim: "Des transformations successives sont documentées.", sequence: 2 },
          { evidenceRef: "ev:krebs:3", kind: "step", label: "Sorties", claim: "Les sorties documentées sont conservées dans la preuve.", sequence: 3 }
        ]
      }
    });

    expect(result.content.cards).toBeUndefined();
    expect(result.content.steps?.[0]?.detail).toBe("L'entrée documentée est Acétyl-CoA.");
    expect(["timeline", "diagram"]).toContain(result.compilation.manifest.selectedKind);
  });

  test("creates an Archimedes simulation only when bounded variables and operation are explicit", () => {
    const result = compileRepresentationFromEvidence({
      topic: "Poussée d'Archimède",
      domain: "education",
      objective: "manipulate_causal_factors",
      learnerLevel: "secondary",
      constraints,
      evidencePacket: {
        interactiveModel: {
          operation: "multiply",
          outputLabel: "Poussée",
          outputUnit: "N"
        },
        items: [
          { evidenceRef: "ev:arch:1", kind: "variable", label: "Densité", claim: "Variable documentée.", id: "rho", min: 500, max: 1500, step: 10, initial: 1000, unit: "kg/m3" },
          { evidenceRef: "ev:arch:2", kind: "variable", label: "Volume", claim: "Variable documentée.", id: "volume", min: 0.1, max: 2, step: 0.1, initial: 1, unit: "m3" },
          { evidenceRef: "ev:arch:3", kind: "variable", label: "Gravité", claim: "Variable documentée.", id: "gravity", min: 1, max: 12, step: 0.1, initial: 9.8, unit: "m/s2" }
        ]
      }
    });

    expect(result.inferredSignals.dynamicProcess).toBe(true);
    expect(result.content.interactiveModel?.operation).toBe("multiply");
    expect(result.compilation.manifest.selectedKind).toBe("simulation");
    expect(result.compilation.html).toContain('data-operation="multiply"');
  });

  test("surfaces contradictory evidence instead of silently merging it", () => {
    const result = compileRepresentationFromEvidence({
      topic: "Taux officiel",
      domain: "general",
      objective: "summarize",
      constraints,
      evidencePacket: {
        items: [
          { evidenceRef: "ev:a", kind: "fact", label: "Taux", claim: "Le taux est 10.", contradictionKey: "official-rate" },
          { evidenceRef: "ev:b", kind: "fact", label: "Taux", claim: "Le taux est 12.", contradictionKey: "official-rate" }
        ]
      }
    });

    expect(result.diagnostics.some(item => item.code === "EVIDENCE_CONTRADICTION")).toBe(true);
    expect(result.content.cards).toBeUndefined();
    expect(result.compilation.html).not.toContain("Le taux est 10.");
    expect(result.compilation.html).not.toContain("Le taux est 12.");
  });

  test("fails closed when an evidence item has no reference", () => {
    expect(() => compileRepresentationFromEvidence({
      topic: "Sujet",
      domain: "general",
      objective: "summarize",
      constraints,
      evidencePacket: {
        items: [
          { evidenceRef: "", kind: "fact", label: "Fait", claim: "Non sourcé" }
        ]
      }
    } as RepresentationEvidenceCompileRequest)).toThrow(/EVIDENCE_ITEM_REFERENCE_REQUIRED/);
  });

  test("fails closed when an explicit interactive model requests an unsupported operation", () => {
    expect(() => compileRepresentationFromEvidence({
      topic: "Modèle",
      domain: "education",
      objective: "manipulate_causal_factors",
      constraints,
      evidencePacket: {
        interactiveModel: {
          operation: "eval",
          outputLabel: "Résultat"
        },
        items: [
          { evidenceRef: "ev:1", kind: "variable", label: "A", claim: "Variable.", id: "a", min: 0, max: 10, step: 1, initial: 5 }
        ]
      }
    } as unknown as RepresentationEvidenceCompileRequest)).toThrow(/EVIDENCE_MODEL_UNSUPPORTED_OPERATION/);
  });

  test("exposes the evidence-to-artifact pipeline through a governed MCP scope", () => {
    const indexSource = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");

    expect(indexSource).toContain('register("representation.evidence.compile"');
    expect(indexSource).toContain('"representation:evidence:compile"');
  });
});
