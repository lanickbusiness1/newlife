import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../app/formation-ia-2026/page.tsx", import.meta.url), "utf8");
const renderedCandidateSource = source
  .split("\n")
  .filter((line) => !line.includes("noPublicAmountPattern"))
  .filter((line) => !line.includes("visibleData.includes"))
  .filter((line) => !line.includes("Brand variant detected"))
  .join("\n");
const renderedCandidateLower = renderedCandidateSource.toLowerCase();
const join = (...parts) => parts.join("");

const forbiddenPublicCommercialTokens = [
  join("100", " 000", " G", "NF"),
  join("250", " 000", " G", "NF"),
  join("7", " 500", " 000", " G", "NF"),
  join("F", "CFA"),
  join("U", "SD"),
  join("E", "UR"),
  join("p", "rix"),
  join("tar", "if"),
  join("co", "ût"),
];

describe("Professeur Amani IA — Formation IA 2026 landing", () => {
  it("keeps the canonical AfrIAgenesis brand spelling", () => {
    assert.ok(source.includes("AfrIAgenesis"));
    assert.equal(/Afriagenesis|AFRIAGENESIS|AfriAgenesis|AfriaGenesis/.test(renderedCandidateSource), false);
  });

  it("does not expose public commercial amount tokens", () => {
    for (const token of forbiddenPublicCommercialTokens) {
      assert.equal(renderedCandidateLower.includes(token.toLowerCase()), false, `Forbidden public commercial token detected: ${token}`);
    }
  });

  it("keeps WhatsApp conversion, avatar disclosure, and required deliverables", () => {
    assert.ok(source.includes('const WHATSAPP_BASE = "https://wa.me/224611406262";'));
    assert.ok(source.includes("Professeur Amani IA est un avatar pédagogique déclaré"));
    assert.ok(source.includes("IA Toolkit — 50 Prompts"));
    assert.ok(source.includes("Certificat après validation"));
    assert.ok(source.includes("Assistant AfrIAgenesis"));
  });

  it("keeps the mandatory public route structure", () => {
    for (const sectionId of ["programme", "parcours", "livrables", "contact"]) {
      assert.ok(source.includes(`id=\"${sectionId}\"`) || source.includes(`href=\"#${sectionId}\"`));
    }
    assert.ok(source.includes("Former l’Afrique à coder, produire et décider avec l’IA."));
    assert.ok(source.includes("30 % compréhension, 70 % production utile"));
  });
});
