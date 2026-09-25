import { readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
const manifest = JSON.parse(await readFile(join(dist, "release-manifest.json"), "utf8"));

const failures = [];
if (manifest.schema !== "afriagenesis.release-manifest.v1") failures.push("invalid manifest schema");
if (manifest.version !== "0.3.0-recovery") failures.push("invalid release version");
if (manifest.truthState !== "TEST_PROVEN_ON_BRANCH") failures.push("invalid truth state");
if (manifest.deploymentState !== "NOT_DEPLOYED") failures.push("deployment state must remain NOT_DEPLOYED");
if (!Array.isArray(manifest.files) || manifest.files.length < 10) failures.push("runtime file inventory incomplete");

for (const entry of manifest.files || []) {
  const path = join(dist, entry.path);
  const bytes = await readFile(path);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== entry.sha256) failures.push("hash mismatch: " + entry.path);
  if (bytes.length !== entry.bytes) failures.push("size mismatch: " + entry.path);
}

async function walk(dir, prefix = "") {
  const results = [];
  for (const item of await readdir(dir)) {
    const abs = join(dir, item);
    const rel = prefix ? prefix + "/" + item : item;
    const info = await stat(abs);
    if (info.isDirectory()) results.push(...await walk(abs, rel));
    else results.push(rel);
  }
  return results;
}

const packaged = await walk(dist);
for (const forbidden of ["test/", "e2e/", "scripts/", "node_modules/", ".git/", ".github/"]) {
  if (packaged.some((path) => path.startsWith(forbidden))) {
    failures.push("forbidden deployment content: " + forbidden);
  }
}

const expected = new Set((manifest.files || []).map((item) => item.path).concat("release-manifest.json"));
for (const path of packaged) {
  if (!expected.has(path)) failures.push("unexpected runtime file: " + path);
}
for (const path of expected) {
  if (!packaged.includes(path)) failures.push("missing runtime file: " + path);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Release candidate verified:", packaged.length, "files including manifest");
