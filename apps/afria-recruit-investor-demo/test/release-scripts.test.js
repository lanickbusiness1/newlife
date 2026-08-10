import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packagePages } from '../scripts/package-pages.mjs';
import { scanPublicBundle } from '../scripts/scan-public-bundle.mjs';

test('public bundle scanner permits a browser publishable key', async () => {
  const bundle = await mkdtemp(join(tmpdir(), 'afria-clean-bundle-'));
  const anonJwt = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from('{"role":"anon"}').toString('base64url'),
    'public-signature-placeholder',
  ].join('.');
  await writeFile(
    join(bundle, 'index.js'),
    `const key = 'sb_publishable_example'; const documentedSecretPrefix = 'sb_secret_'; const legacyAnon = '${anonJwt}';`,
  );

  assert.deepEqual(await scanPublicBundle(bundle), []);
});

test('public bundle scanner catches secrets, fabricated claims, and source maps', async () => {
  const bundle = await mkdtemp(join(tmpdir(), 'afria-unsafe-bundle-'));
  await writeFile(join(bundle, 'index.js'), "const role = 'service_role'; const claim = '184.5 M GNF';");
  await writeFile(join(bundle, 'index.js.map'), '{}');

  const findings = await scanPublicBundle(bundle);

  assert.deepEqual(findings.map((finding) => finding.rule).sort(), [
    'fabricated-investor-claim',
    'server-secret-marker',
    'source-map',
  ]);
});

test('public bundle scanner rejects a legacy Supabase service-role JWT', async () => {
  const bundle = await mkdtemp(join(tmpdir(), 'afria-legacy-secret-bundle-'));
  const serviceRoleJwt = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
    Buffer.from('{"role":"service_role","iss":"supabase"}').toString('base64url'),
    'secret-signature-placeholder',
  ].join('.');
  await writeFile(join(bundle, 'index.js'), `const credential = '${serviceRoleJwt}';`);

  assert.deepEqual(await scanPublicBundle(bundle), [
    { rule: 'server-secret-marker', file: 'index.js' },
  ]);
});

test('robots excludes Recruit staging while allowing the preserved Accelerator path', async () => {
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');

  assert.match(robots, /^Allow: \/startup-accelerator\/$/m);
  assert.match(robots, /^Disallow: \/$/m);
});

test('Pages packager publishes the verified Recruit bundle and preserves Accelerator under a subpath', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'afria-pages-fixture-'));
  const recruitDist = join(fixture, 'recruit-dist');
  const acceleratorIndex = join(fixture, 'accelerator', 'index.html');
  const outputDir = join(fixture, 'site');
  await mkdir(join(recruitDist, 'assets'), { recursive: true });
  await mkdir(join(fixture, 'accelerator'), { recursive: true });
  await writeFile(join(recruitDist, 'index.html'), '<h1>AfrIA Recruit</h1>');
  await writeFile(join(recruitDist, 'assets', 'app.js'), 'console.log("verified")');
  await writeFile(acceleratorIndex, '<h1>Startup Accelerator</h1>');

  const manifest = await packagePages({
    recruitDist,
    acceleratorIndex,
    outputDir,
    sha: 'abc123',
    builtAt: '2026-08-10T10:00:00.000Z',
  });

  assert.deepEqual(manifest, {
    product: 'PRD-RECRUIT-001',
    sha: 'abc123',
    builtAt: '2026-08-10T10:00:00.000Z',
    root: 'afria-recruit-investor-staging',
    preservedPaths: ['startup-accelerator/'],
  });
  assert.equal(await readFile(join(outputDir, 'index.html'), 'utf8'), '<h1>AfrIA Recruit</h1>');
  assert.equal(await readFile(join(outputDir, 'assets', 'app.js'), 'utf8'), 'console.log("verified")');
  assert.equal(await readFile(join(outputDir, 'startup-accelerator', 'index.html'), 'utf8'), '<h1>Startup Accelerator</h1>');
  assert.deepEqual(JSON.parse(await readFile(join(outputDir, 'release.json'), 'utf8')), manifest);
});
