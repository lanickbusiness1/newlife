import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "package.json",
  "app/page.tsx",
  "app/layout.tsx",
  "app/globals.css",
  "tsconfig.json",
  "postcss.config.js",
  "tailwind.config.ts",
  ".env.example",
];

const requiredEnv = [
  "NEXT_PUBLIC_FORM_WEBHOOK",
  "NEXT_PUBLIC_DEMO_VIDEO_URL",
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
const envExamplePath = path.join(root, ".env.example");
const envExample = fs.existsSync(envExamplePath) ? fs.readFileSync(envExamplePath, "utf8") : "";
const missingEnv = requiredEnv.filter((key) => !envExample.includes(key));

const codeVerified = missingFiles.length === 0 && missingEnv.length === 0;
const status = codeVerified ? "CODE_VERIFIE" : "CONTRAT_INCOMPLET";

const report = {
  project: "GDIZ Smart Service Node",
  root_directory: "apps/web",
  target_platform: "Vercel",
  status,
  deployment_confirmed: false,
  deployment_gate: codeVerified ? "CONFIGURATION_EXTERNE_REQUISE" : "CODE_INCOMPLET",
  missing_files: missingFiles,
  missing_env_keys: missingEnv,
};

console.log(JSON.stringify(report, null, 2));

if (!codeVerified) {
  process.exit(1);
}
