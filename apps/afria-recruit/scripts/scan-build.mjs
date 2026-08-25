import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || '.next/static');
const forbidden = [
  /sk-proj-[A-Za-z0-9_-]{12,}/,
  /SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*['\"][^'\"]+/i,
  /OPENAI_API_KEY\s*[=:]\s*['\"][^'\"]+/i,
  /service_role[^A-Za-z0-9_]/i,
  /sourceMappingURL=/,
];

async function files(path) {
  const info = await stat(path);
  if (info.isFile()) return [path];
  const entries = await readdir(path);
  const nested = await Promise.all(entries.map((entry) => files(resolve(path, entry))));
  return nested.flat();
}

const findings = [];
for (const path of await files(root)) {
  if (!/\.(js|css|html|json)$/i.test(path)) continue;
  const content = await readFile(path, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(content)) findings.push(`${path}: ${pattern}`);
  }
}

if (findings.length) {
  console.error('Public bundle scan failed:\n' + findings.join('\n'));
  process.exit(1);
}
console.log(`Public bundle scan passed: ${root}`);
