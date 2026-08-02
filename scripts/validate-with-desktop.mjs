import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  fingerprintConsumerAuthority,
  loadPolicy,
  parseArguments,
  readJson,
  requiredAbsolutePath,
} from './lib/contracts.mjs';

const policy = loadPolicy();
const arguments_ = parseArguments(process.argv.slice(2), [
  'desktop-dir',
  'payload',
  'publication-mode',
]);
const desktopRoot = requiredAbsolutePath(arguments_, 'desktop-dir');
const payloadPath = requiredAbsolutePath(arguments_, 'payload');
const validatorPath = resolve(desktopRoot, policy.consumer.validator);
const publicationMode = arguments_['publication-mode'] ?? 'production';
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
assertDeploymentPolicy(publicationMode);
if (!existsSync(validatorPath) || !existsSync(compiledValidatorDependency)) {
  throw new Error('Desktop must be built before consumer validation.');
}
const validation = spawnSync(
  process.execPath,
  [
    validatorPath,
    'validate',
    '--payload',
    payloadPath,
    '--publication-mode',
    publicationMode,
  ],
  { cwd: resolve(desktopRoot, 'desktop'), encoding: 'utf8' },
);
if (validation.status !== 0) {
  process.stderr.write(validation.stderr);
  throw new Error('The pinned Desktop consumer rejected the catalog payload.');
}
process.stdout.write(validation.stdout);

function assertDeploymentPolicy(mode) {
  if (
    mode !== policy.owner_pilot.publication_mode &&
    mode !== policy.owner_pilot.kill_switch_publication_mode
  ) {
    return;
  }
  const deployment = readJson(
    resolve(
      desktopRoot,
      'desktop',
      'src',
      'providerCatalogDeploymentPolicy.json',
    ),
  );
  if (
    deployment.mode !== policy.owner_pilot.publication_mode ||
    deployment.max_catalog_lifetime_days !==
      policy.owner_pilot.max_catalog_lifetime_days ||
    JSON.stringify(deployment.allowed_providers) !==
      JSON.stringify(policy.owner_pilot.allowed_providers)
  ) {
    throw new Error('Catalog owner-pilot policy differs from Desktop.');
  }
}

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
  const fingerprint = fingerprintConsumerAuthority(
    desktopRoot,
    desktopCommit,
  );
  if (
    ancestry.status !== 0 ||
    fingerprint !== policy.consumer.authority_sha256
  ) {
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
