import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pageUrl = new URL("../../simandou.html", import.meta.url);
const scriptUrl = new URL("../../simandou.js", import.meta.url);

async function readSurface(): Promise<{ html: string; script: string }> {
  return {
    html: await readFile(pageUrl, "utf8"),
    script: await readFile(scriptUrl, "utf8"),
  };
}

test("Mission Control permanently identifies itself as a synthetic sandbox", async () => {
  const { html } = await readSurface();
  assert.match(html, /SYNTHETIC SANDBOX/i);
  assert.match(html, /aucune donnée réelle/i);
  assert.match(html, /data-sandbox-banner="permanent"/i);
  assert.doesNotMatch(html, /Production Ready|déployé en production|certifié par le GDB/i);
});

test("Mission Control exposes the seven sovereign KPI cards", async () => {
  const { html } = await readSurface();
  for (const label of [
    "Value Capture Ratio",
    "Fiscal Take",
    "State Equity Return",
    "FX Retention Ratio",
    "Local Procurement Ratio",
    "Domestic Transformation Ratio",
    "Simandou-to-Economy Conversion Ratio",
  ]) {
    assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("Mission Control contains the five required operating workspaces", async () => {
  const { html } = await readSurface();
  for (const view of ["mine-to-cash", "expected-received", "exceptions-capa", "evidence-room", "scenario-lab"]) {
    assert.match(html, new RegExp(`data-view=["']${view}["']`, "i"));
  }
});

test("Mission Control distinguishes FACT, HYPOTHESIS and SIMULATION", async () => {
  const { html } = await readSurface();
  assert.match(html, />FACT</);
  assert.match(html, />HYPOTHESIS</);
  assert.match(html, />SIMULATION</);
});

test("Scenario Lab refuses to display a Value Capture Ratio before methodology approval", async () => {
  const { script } = await readSurface();
  assert.match(script, /METHOD_NOT_APPROVED/);
  assert.match(script, /methodologyApproved/);
  assert.match(script, /valueCaptureRatioPercent/);
});

test("surface is responsive, low-bandwidth friendly and accessible", async () => {
  const { html } = await readSurface();
  assert.match(html, /<meta name="viewport"/i);
  assert.match(html, /<main\b/i);
  assert.match(html, /aria-live=/i);
  assert.match(html, /@media\s*\(max-width:/i);
  assert.doesNotMatch(html, /https:\/\/fonts\.|<video|autoplay/i);
});
