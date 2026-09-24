import { readFile } from "node:fs/promises";
import { recoveryManifest, surfaces, tournamentState } from "../src/model.mjs";
import { hostDataset, qualifiedHostTeams, validateHostDataset } from "../src/hosts.mjs";

const root = new URL("../", import.meta.url);
const files = [
  "README.md", "index.html", "styles.css", "manifest.webmanifest", "service-worker.js",
  "src/model.mjs", "src/provenance.mjs", "src/hosts.mjs", "src/preferences.mjs", "src/vault.mjs", "src/ui.mjs"
];
const contents = await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")));

const failures = [];

if (recoveryManifest.targetYear !== 2030) failures.push("targetYear must be 2030");
if (recoveryManifest.canonicalIdentity !== "UNRESOLVED") failures.push("canonical identity must remain unresolved");
if (recoveryManifest.productTruth !== "RECOVERY_ARTIFACT") failures.push("truth state must remain RECOVERY_ARTIFACT");
if (tournamentState.teams.length || tournamentState.fixtures.length || tournamentState.qualification.length) {
  failures.push("unsourced tournament arrays must remain empty");
}
if (!validateHostDataset(hostDataset).ok) failures.push("host dataset provenance invalid");
if (qualifiedHostTeams.length !== 6) failures.push("six source-proven automatic host qualifications required");
if (surfaces.length < 8) failures.push("recovered navigation surfaces are incomplete");

const joined = contents.join("\n").toLowerCase();
const forbiddenClaims = ["production_proven", "qualified: guinea", "guinée qualifiée", "endorsed by fifa", "official fifa partner"];
for (const claim of forbiddenClaims) {
  if (joined.includes(claim)) failures.push("forbidden unsupported claim detected: " + claim);
}
if (!joined.includes("not** an official fifa app") && !joined.includes("not an official fifa app")) {
  failures.push("independence disclaimer missing");
}
if (!joined.includes("service-worker.js") || !joined.includes("manifest.webmanifest")) failures.push("PWA shell missing");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Recovery checks passed: 2030 source-proven hosts, fail-closed fixtures, PWA shell, non-canonical truth state.");
