import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function packagePages({
  recruitDist,
  acceleratorIndex,
  outputDir,
  sha,
  builtAt = new Date().toISOString(),
}) {
  const sourceDirectory = resolve(recruitDist);
  const acceleratorFile = resolve(acceleratorIndex);
  const destination = resolve(outputDir);

  await readFile(join(sourceDirectory, 'index.html'));
  await readFile(acceleratorFile);
  await mkdir(dirname(destination), { recursive: true });
  await mkdir(destination);

  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    await cp(join(sourceDirectory, entry.name), join(destination, entry.name), {
      recursive: entry.isDirectory(),
      force: false,
      errorOnExist: true,
    });
  }

  const acceleratorDirectory = join(destination, 'startup-accelerator');
  await mkdir(acceleratorDirectory);
  await cp(acceleratorFile, join(acceleratorDirectory, basename(acceleratorFile)), {
    force: false,
    errorOnExist: true,
  });

  const manifest = {
    product: 'PRD-RECRUIT-001',
    sha,
    builtAt,
    root: 'afria-recruit-investor-staging',
    preservedPaths: ['startup-accelerator/'],
  };
  await writeFile(join(destination, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  return manifest;
}

async function main() {
  const [recruitDist, acceleratorIndex, outputDir, sha = 'local'] = process.argv.slice(2);
  if (!recruitDist || !acceleratorIndex || !outputDir) {
    throw new Error(
      'Usage: package-pages.mjs <recruit-dist> <accelerator-index> <output-dir> [sha]',
    );
  }

  const manifest = await packagePages({ recruitDist, acceleratorIndex, outputDir, sha });
  console.log(JSON.stringify(manifest));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
