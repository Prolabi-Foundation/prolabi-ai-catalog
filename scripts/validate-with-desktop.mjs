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

const desktopCommit = commandOutput('git', [
  '-C',
  desktopRoot,
  'rev-parse',
  'HEAD',
]);
assertConsumerAuthority(desktopCommit);
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

function assertConsumerAuthority(desktopCommit) {
  if (desktopCommit === policy.consumer.commit) {
    return;
  }
  const ancestry = spawnSync(
    'git',
    [
      '-C',
      desktopRoot,
      'merge-base',
      '--is-ancestor',
      policy.consumer.commit,
      desktopCommit,
    ],
    { encoding: 'utf8' },
  );
  const authorityDiff = spawnSync(
    'git',
    [
      '-C',
      desktopRoot,
      'diff',
      '--quiet',
      `${policy.consumer.commit}..${desktopCommit}`,
      '--',
      ...policy.consumer.authority_paths,
    ],
    { encoding: 'utf8' },
  );
  if (ancestry.status !== 0 || authorityDiff.status !== 0) {
    throw new Error(
      'Desktop changed catalog authority after the pinned consumer commit.',
    );
  }
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0 || result.stdout.trim().length === 0) {
    throw new Error('Desktop source identity could not be resolved.');
  }
  return result.stdout.trim();
}
