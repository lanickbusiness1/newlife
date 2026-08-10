import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(appRoot, "../..");
const packageJson = JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8"));
const deploybot = readFileSync(path.join(appRoot, "scripts", "deploybot-check.mjs"), "utf8");
const dependabot = readFileSync(path.join(repositoryRoot, ".github", "dependabot.yml"), "utf8");
const retiredVercelWorkflow = path.join(repositoryRoot, ".github", "workflows", "gdiz-vercel-deploy.yml");

const workflow = (name) =>
  readFileSync(path.join(repositoryRoot, ".github", "workflows", name), "utf8");

test("the GDIZ dependency graph is immutable and CI installs it exactly", () => {
  const lock = JSON.parse(readFileSync(path.join(appRoot, "package-lock.json"), "utf8"));

  assert.equal(lock.lockfileVersion, 3);
  assert.deepEqual(lock.packages[""].dependencies, packageJson.dependencies);
  assert.deepEqual(lock.packages[""].devDependencies, packageJson.devDependencies);
  assert.equal(packageJson.scripts.typecheck, "next typegen && tsc --noEmit");

  const source = workflow("gdiz-deploybot-check.yml");
  assert.match(source, /cache-dependency-path: apps\/web\/package-lock\.json/);
  assert.match(source, /run: npm ci --ignore-scripts/);
  assert.doesNotMatch(source, /run: npm install(?:\s|$)/m);
});

test("no workflow can claim a GDIZ production deployment without a Vercel project", () => {
  assert.equal(existsSync(retiredVercelWorkflow), false);
  assert.equal(packageJson.devDependencies.vercel, undefined);
});

test("the local readiness check does not claim an external deployment exists", () => {
  assert.doesNotMatch(deploybot, /PRET_AU_DEPLOIEMENT/);
  assert.doesNotMatch(deploybot, /Créer\/brancher/);
  assert.match(deploybot, /CODE_VERIFIE/);
  assert.match(deploybot, /CONFIGURATION_EXTERNE_REQUISE/);
});

test("the locked GDIZ graph receives automated dependency updates", () => {
  assert.match(dependabot, /package-ecosystem: npm\n\s+directory: \/apps\/web\n/);
});
