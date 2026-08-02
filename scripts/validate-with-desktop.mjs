import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  loadPolicy,
  parseArguments,
  requiredAbsolutePath,
} from './lib/contracts.mjs';

const policy = loadPolicy();
const arguments_ = parseArguments(process.argv.slice(2), [
  'desktop-dir',
  'payload',
]);
const desktopRoot = requiredAbsolutePath(arguments_, 'desktop-dir');
const payloadPath = requiredAbsolutePath(arguments_, 'payload');
const validatorPath = resolve(desktopRoot, policy.consumer.validator);
const compiledValidatorDependency = resolve(
  desktopRoot,
  'desktop',
  'dist',
  'providerCatalogPublication.js',
);

assertCommand(
  'git',
  ['-C', desktopRoot, 'rev-parse', 'HEAD'],
  policy.consumer.commit,
  'Desktop checkout does not match the pinned consumer commit.',
);
if (!existsSync(validatorPath) || !existsSync(compiledValidatorDependency)) {
  throw new Error('Desktop must be built before consumer validation.');
}
const validation = spawnSync(
  process.execPath,
  [validatorPath, 'validate', '--payload', payloadPath],
  { cwd: resolve(desktopRoot, 'desktop'), encoding: 'utf8' },
);
if (validation.status !== 0) {
  process.stderr.write(validation.stderr);
  throw new Error('The pinned Desktop consumer rejected the catalog payload.');
}
process.stdout.write(validation.stdout);

function assertCommand(command, args, expected, message) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0 || result.stdout.trim() !== expected) {
    throw new Error(message);
  }
}
