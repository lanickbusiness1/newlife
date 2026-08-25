import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const root = resolve(process.cwd());
const roots = ['app', 'components', 'lib', 'tests'].map((path) => resolve(root, path));
const textFile = /\.(?:ts|tsx|js|mjs|json|md|css)$/i;
const secretPatterns = [
  /sk-(?:proj|svcacct)-[A-Za-z0-9_-]{12,}/,
  /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /(?:SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY)\s*=\s*['\"]?[A-Za-z0-9_./+-]{8,}/,
];
const personalEmail = /\b[A-Z0-9._%+-]+@(?!example\.(?:com|org|net)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const internationalPhone = /\+\d[\d\s().-]{7,}\d/;
const findings = [];

async function walk(path) {
  const info = await stat(path);
  if (info.isFile()) return [path];
  const entries = await readdir(path);
  return (await Promise.all(entries.map((entry) => walk(resolve(path, entry))))).flat();
}

for (const path of (await Promise.all(roots.map(walk))).flat()) {
  if (!textFile.test(path)) continue;
  const source = await readFile(path, 'utf8');
  const rel = relative(root, path);
  for (const pattern of secretPatterns) {
    if (pattern.test(source)) findings.push(`${rel}: possible secret material (${pattern})`);
  }

  const isSyntheticFixture = /fixture/i.test(rel) || rel.includes('testing/e2e-runtime');
  if (isSyntheticFixture) {
    if (personalEmail.test(source)) findings.push(`${rel}: personal-looking email in synthetic data`);
    if (internationalPhone.test(source)) findings.push(`${rel}: phone-like identifier in synthetic data`);
  }

  if (/^['\"]use client['\"];?/m.test(source)) {
    for (const pattern of [/SUPABASE_SERVICE_ROLE_KEY/, /OPENAI_API_KEY/, /service_role/i, /admin-client/, /createAdminClient/]) {
      if (pattern.test(source)) findings.push(`${rel}: privileged server boundary referenced by client module`);
    }
  }
}

for (const serverOnlyPath of ['lib/supabase/admin-client.ts', 'lib/supabase/config.ts']) {
  const source = await readFile(resolve(root, serverOnlyPath), 'utf8');
  if (/^['\"]use client['\"];?/m.test(source)) findings.push(`${serverOnlyPath}: privileged module marked use client`);
}

if (findings.length) {
  console.error('Source security scan failed:\n' + findings.join('\n'));
  process.exit(1);
}
console.log(`Source security scan passed: ${roots.map((path) => relative(root, path)).join(', ')}`);
