import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

const runtimeFiles = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icon.svg",
  "service-worker.js",
  "src/model.mjs",
  "src/provenance.mjs",
  "src/hosts.mjs",
  "src/preferences.mjs",
  "src/profile.mjs",
  "src/outbox.mjs",
  "src/api-envelope.mjs",
  "src/vault.mjs",
  "src/ui.mjs"
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const files = [];
for (const relative of runtimeFiles) {
  const source = join(root, relative);
  const target = join(dist, relative);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target);
  const bytes = await readFile(target);
  files.push({
    path: relative,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

const manifest = {
  schema: "afriagenesis.release-manifest.v1",
  artifact: "world-cup-2030-supporter-recovery",
  version: "0.3.0-recovery",
  sourceSha: process.env.GITHUB_SHA || "LOCAL_UNBOUND",
  truthState: "TEST_PROVEN_ON_BRANCH",
  deploymentState: "NOT_DEPLOYED",
  files
};

await writeFile(
  join(dist, "release-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);

console.log("Release candidate built:", files.length, "runtime files");
console.log("Source SHA:", manifest.sourceSha);
