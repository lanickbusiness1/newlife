import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const root = resolve(process.cwd());

async function walk(path: string): Promise<string[]> {
  const info = await stat(path);
  if (info.isFile()) return [path];
  const entries = await readdir(path);
  return (await Promise.all(entries.map((entry) => walk(resolve(path, entry))))).flat();
}

test('package exposes a source security scan in the canonical check pipeline', async () => {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts['scan:source'] ?? '', /scan-source\.mjs/);
  assert.match(pkg.scripts.check ?? '', /scan:source/);
});

test('client modules never reference privileged server secrets or admin boundaries', async () => {
  const roots = [resolve(root, 'components'), resolve(root, 'app')];
  const files = (await Promise.all(roots.map(walk))).flat().filter((file) => /\.(ts|tsx)$/.test(file));
  const forbidden = [
    /SUPABASE_SERVICE_ROLE_KEY/,
    /OPENAI_API_KEY/,
    /service_role/i,
    /admin-client/,
    /createAdminClient/,
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (!/^['\"]use client['\"];?/m.test(source)) continue;
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${relative(root, file)} contains ${pattern}`);
    }
  }
});

test('server privileged client cannot be marked as a client module', async () => {
  const source = await readFile(resolve(root, 'lib/supabase/admin-client.ts'), 'utf8');
  assert.doesNotMatch(source, /^['\"]use client['\"];?/m);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY|service role key/i);
});

test('synthetic fixtures contain no personal email address or international phone number', async () => {
  const files = (await walk(resolve(root, 'lib/repositories'))).filter((file) => /fixture.*\.ts$/.test(file));
  const personalEmail = /\b[A-Z0-9._%+-]+@(?!example\.(?:com|org|net)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const internationalPhone = /(?:\+|00)\d[\d\s().-]{7,}\d/;
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, personalEmail, `${relative(root, file)} contains a personal-looking email`);
    assert.doesNotMatch(source, internationalPhone, `${relative(root, file)} contains a phone-like identifier`);
  }
});

test('CI-only synthetic runtime requires GitHub Actions in addition to generic CI', async () => {
  const source = await readFile(resolve(root, 'lib/testing/e2e-runtime.ts'), 'utf8');
  assert.match(source, /GITHUB_ACTIONS\s*===\s*['\"]true['\"]/);
  assert.match(source, /AFRIA_RECRUIT_E2E_MODE\s*===\s*['\"]1['\"]/);
  assert.match(source, /CI\s*===\s*['\"]true['\"]/);
});
