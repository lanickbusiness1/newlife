import { readFile } from "node:fs/promises";
import { recoveryManifest, surfaces, tournamentState } from "../src/model.mjs";

const root = new URL("../", import.meta.url);
const files = ["README.md", "index.html", "styles.css", "src/model.mjs", "src/ui.mjs"];
const contents = await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")));

const failures = [];

if (recoveryManifest.targetYear !== 2030) failures.push("targetYear must be 2030");
if (recoveryManifest.canonicalIdentity !== "UNRESOLVED") failures.push("canonical identity must remain unresolved");
if (recoveryManifest.productTruth !== "RECOVERY_ARTIFACT") failures.push("truth state must remain RECOVERY_ARTIFACT");
if (tournamentState.teams.length || tournamentState.fixtures.length || tournamentState.qualification.length) {
  failures.push("official tournament data must remain empty until sourced");
}
if (surfaces.length < 6) failures.push("recovered navigation surfaces are incomplete");

const joined = contents.join("\n").toLowerCase();
const forbiddenClaims = ["official fifa app", "production_proven", "qualified: guinea", "guinée qualifiée"];
for (const claim of forbiddenClaims) {
  if (joined.includes(claim)) failures.push(`forbidden unsupported claim detected: ${claim}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Recovery checks passed: 2030 target, fail-closed tournament data, non-canonical truth state.");
