import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(path.join(appRoot, "app", "page.tsx"), "utf8");
const layout = readFileSync(path.join(appRoot, "app", "layout.tsx"), "utf8");

test("the public concept contains no fabricated proof, endorsement, or contact data", () => {
  const forbiddenClaims = [
    "2m14",
    "22.6%",
    "Direction exploitation",
    "Lounge premium",
    "Partenaire innovation",
    "+229 00 00 00 00",
    "2026 Ready",
    "dQw4w9WgXcQ",
    "Service instantané",
    "QR intelligent",
    "Lead qualifié",
    "Pilotage manager",
    "Chaque table devient",
    "moteur de qualification prospect",
    "assistant commercial intelligent",
    "en temps réel",
    "Réduit la friction",
    "Capte de la first-party data",
    "Système de service, expérience client et acquisition pilotable",
    "Je peux estimer",
  ];

  for (const claim of forbiddenClaims) {
    assert.doesNotMatch(page, new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("optional integrations fail closed instead of simulating success", () => {
  assert.match(page, /const videoEmbedUrl = process\.env\.NEXT_PUBLIC_DEMO_VIDEO_URL \|\| ""/);
  assert.match(page, /if \(!formWebhookUrl\)/);
  assert.match(page, /Démonstration non configurée/);
  assert.match(page, /CONCEPT — NON DÉPLOYÉ/);
});

test("the unverified concept cannot be indexed as a production product", () => {
  assert.match(layout, /description: "Concept interne AfrIAgenesis/);
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
  assert.match(layout, /noarchive: true/);
});
