import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);

test('canonical app has safe scripts and no browser service-role variable', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8')) as {
    name: string;
    scripts: Record<string, string>;
  };

  assert.equal(pkg.name, 'afria-recruit');
  assert.match(pkg.scripts.check, /test:unit/);
  assert.match(pkg.scripts.check, /typecheck/);
  assert.match(pkg.scripts.check, /build/);

  const env = await readFile(new URL('.env.example', root), 'utf8');
  assert.doesNotMatch(env, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/i);
});
