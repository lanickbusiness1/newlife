import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const files = readdirSync("tests")
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => `tests/${name}`);

if (files.length === 0) {
  console.error("No test files found");
  process.exit(1);
}

for (const file of files) {
  console.log(`\n=== TEST ${file} ===`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", file],
    { stdio: "inherit", env: process.env },
  );
  if (result.error) {
    console.error(`Unable to execute ${file}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nAll ${files.length} test files passed serially.`);
