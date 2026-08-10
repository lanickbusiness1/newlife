import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.svg',
  '.txt',
  '.xml',
]);

const CONTENT_RULES = [
  {
    rule: 'server-secret-marker',
    pattern:
      /\bservice_role\b|SUPABASE_(?:SERVICE_ROLE|SERVICE|SECRET)_KEY|sb_secret_[A-Za-z0-9_-]{16,}|sk-proj-[A-Za-z0-9_-]{16,}|sk_live_[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
  },
  {
    rule: 'fabricated-investor-claim',
    pattern:
      /184(?:[.,]5)\s*M\s*GNF|1[\s\u00a0.,]?284\s+candidat|146\s+match|23\s+placement|CIAUD|Orange\s+Guin[ée]e?/i,
  },
];

function containsServiceRoleJwt(content) {
  const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\b/g;

  for (const match of content.matchAll(jwtPattern)) {
    try {
      const payload = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
      if (payload?.role === 'service_role') {
        return true;
      }
    } catch {
      // A malformed JWT-looking string is not treated as a credential.
    }
  }

  return false;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function scanPublicBundle(rootDirectory) {
  const root = resolve(rootDirectory);
  const findings = [];

  for (const filePath of await listFiles(root)) {
    const file = relative(root, filePath).replaceAll('\\', '/');
    if (filePath.endsWith('.map')) {
      findings.push({ rule: 'source-map', file });
      continue;
    }

    if (!TEXT_EXTENSIONS.has(extname(filePath).toLowerCase())) {
      continue;
    }

    const content = await readFile(filePath, 'utf8');
    const matchedRules = new Set();
    for (const { rule, pattern } of CONTENT_RULES) {
      if (pattern.test(content)) {
        matchedRules.add(rule);
      }
    }
    if (containsServiceRoleJwt(content)) {
      matchedRules.add('server-secret-marker');
    }
    for (const rule of matchedRules) {
      findings.push({ rule, file });
    }
  }

  return findings.sort((left, right) =>
    `${left.file}:${left.rule}`.localeCompare(`${right.file}:${right.rule}`),
  );
}

async function main() {
  const root = process.argv[2] ?? 'dist';
  const findings = await scanPublicBundle(root);

  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.rule}: ${finding.file}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Public bundle verified: ${resolve(root)}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
