import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';

import { loadPolicy, REPOSITORY_ROOT } from './lib/contracts.mjs';

const EXCLUDED_DIRECTORIES = new Set([
  '.consumer',
  '.git',
  'coverage',
  'node_modules',
]);
const PRIVATE_KEY_EXTENSIONS = new Set([
  '.der',
  '.jks',
  '.key',
  '.p12',
  '.pfx',
  '.pem',
]);
const MAX_SCANNED_FILE_BYTES = 2 * 1024 * 1024;
const RELEASE_ASSET_PATTERN =
  /^prolabi-provider-model-catalog-[0-9]{4}\.[0-9]{2}\.[0-9]+\.json$/u;
const PRIVATE_KEY_MARKER = new RegExp(
  ['-----BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE KEY-----'].join(''),
  'u',
);

loadPolicy();

const violations = [];
for (const path of walk(REPOSITORY_ROOT)) {
  const repositoryPath = relative(REPOSITORY_ROOT, path).replaceAll('\\', '/');
  const filename = repositoryPath.split('/').at(-1) ?? '';
  if (PRIVATE_KEY_EXTENSIONS.has(extname(filename).toLowerCase())) {
    violations.push(`${repositoryPath}: private-key file type is forbidden`);
    continue;
  }
  if (RELEASE_ASSET_PATTERN.test(filename)) {
    violations.push(`${repositoryPath}: release assets must remain outside Git`);
    continue;
  }
  const size = statSync(path).size;
  if (size > MAX_SCANNED_FILE_BYTES) {
    violations.push(`${repositoryPath}: repository file exceeds 2 MiB`);
    continue;
  }
  if (repositoryPath === 'scripts/check-repository.mjs') {
    continue;
  }
  const serialized = readFileSync(path, 'utf8');
  if (PRIVATE_KEY_MARKER.test(serialized)) {
    violations.push(`${repositoryPath}: private-key material is forbidden`);
  }
  if (extname(filename).toLowerCase() === '.json') {
    inspectJson(repositoryPath, serialized);
  }
}
if (violations.length > 0) {
  throw new Error(`Repository policy failed:\n${violations.join('\n')}`);
}
process.stdout.write('Repository policy is valid; no catalog payloads or private keys are committed.\n');

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.isFile()) {
      yield path;
    } else {
      violations.push(
        `${relative(REPOSITORY_ROOT, path)}: links and special files are forbidden`,
      );
    }
  }
}

function inspectJson(repositoryPath, serialized) {
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    violations.push(`${repositoryPath}: invalid JSON`);
    return;
  }
  const format = value && typeof value === 'object' ? value.format : undefined;
  if (
    format === 'prolabi-provider-model-catalog' ||
    format === 'prolabi-provider-model-catalog-envelope'
  ) {
    violations.push(`${repositoryPath}: catalog payloads must remain outside Git`);
  }
}
