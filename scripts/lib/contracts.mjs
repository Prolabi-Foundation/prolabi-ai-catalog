import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY_ROOT = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
);

const POLICY_KEYS = [
  'consumer',
  'format',
  'format_version',
  'owner_pilot',
  'publication',
  'release',
  'repository',
];
const CONSUMER_AUTHORITY_PATHS = [
  'desktop/scripts/provider-catalog-keyring.mjs',
  'desktop/scripts/provider-catalog.mjs',
  'desktop/src/canonicalJson.ts',
  'desktop/src/jsonContract.ts',
  'desktop/src/main.ts',
  'desktop/src/nativeAiServices.ts',
  'desktop/src/providerCatalogDeploymentPolicy.json',
  'desktop/src/providerCatalogDeploymentPolicy.ts',
  'desktop/src/providerCatalogPublication.ts',
  'desktop/src/providerCatalogTrustedKeys.json',
  'desktop/src/providerCatalogTrustedKeys.ts',
  'desktop/src/providerModelCatalog.ts',
  'desktop/src/providerModelCatalogRepository.ts',
  'desktop/src/semanticVersion.ts',
  'desktop/src/signedCatalog.ts',
];

export function loadPolicy() {
  const path = resolve(REPOSITORY_ROOT, 'policy', 'catalog-policy.json');
  const value = readJson(path);
  if (
    !hasExactKeys(value, POLICY_KEYS) ||
    value.format !== 'prolabi-provider-catalog-repository-policy' ||
    value.format_version !== 1 ||
    value.repository !== 'Prolabi-Foundation/prolabi-ai-catalog' ||
    !hasExactKeys(value.consumer, [
      'authority_sha256',
      'authority_paths',
      'commit',
      'node_version',
      'repository',
      'validation_mode',
      'validator',
    ]) ||
    value.consumer.repository !== 'Prolabi-Foundation/prolabi-desktop' ||
    !/^[0-9a-f]{64}$/u.test(value.consumer.authority_sha256) ||
    !/^[0-9a-f]{40}$/u.test(value.consumer.commit) ||
    !/^\d+\.\d+\.\d+$/u.test(value.consumer.node_version) ||
    value.consumer.validation_mode !== 'pinned-or-authority-equivalent' ||
    value.consumer.validator !== 'desktop/scripts/provider-catalog.mjs' ||
    JSON.stringify(value.consumer.authority_paths) !==
      JSON.stringify(CONSUMER_AUTHORITY_PATHS) ||
    !hasExactKeys(value.owner_pilot, [
      'allowed_providers',
      'kill_switch_publication_mode',
      'max_catalog_lifetime_days',
      'minimum_owner_approvals',
      'publication_mode',
      'scope',
    ]) ||
    JSON.stringify(value.owner_pilot.allowed_providers) !==
      JSON.stringify(['openai']) ||
    value.owner_pilot.kill_switch_publication_mode !==
      'owner-pilot-disabled' ||
    value.owner_pilot.max_catalog_lifetime_days !== 7 ||
    value.owner_pilot.minimum_owner_approvals !== 1 ||
    value.owner_pilot.publication_mode !== 'owner-pilot-openai' ||
    value.owner_pilot.scope !== 'repository-owner-only' ||
    !hasExactKeys(value.publication, [
      'allow_catalog_payloads_in_git',
      'allow_private_keys_in_git_or_ci',
      'minimum_independent_approvals',
    ]) ||
    value.publication.allow_catalog_payloads_in_git !== false ||
    value.publication.allow_private_keys_in_git_or_ci !== false ||
    value.publication.minimum_independent_approvals !== 2 ||
    !hasExactKeys(value.release, [
      'api',
      'asset_name_template',
      'exact_asset_count',
      'max_asset_bytes',
      'require_final',
      'require_immutable',
      'tag_template',
    ]) ||
    value.release.api !==
      'https://api.github.com/repos/Prolabi-Foundation/prolabi-ai-catalog/releases/latest' ||
    value.release.asset_name_template !==
      'prolabi-provider-model-catalog-<YYYY.MM.N>.json' ||
    value.release.exact_asset_count !== 1 ||
    value.release.max_asset_bytes !== 524288 ||
    value.release.require_final !== true ||
    value.release.require_immutable !== true ||
    value.release.tag_template !== 'provider-model-catalog-v<YYYY.MM.N>'
  ) {
    throw new Error('Catalog repository policy is invalid.');
  }
  return Object.freeze(value);
}
export function parseArguments(values, allowedKeys) {
  if (values.length % 2 !== 0) {
    throw new Error('Arguments must use --name value pairs.');
  }
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const option = values[index];
    const value = values[index + 1];
    if (
      !option?.startsWith('--') ||
      !allowedKeys.includes(option.slice(2)) ||
      typeof value !== 'string' ||
      value.length === 0 ||
      option.slice(2) in parsed
    ) {
      throw new Error('Arguments are invalid.');
    }
    parsed[option.slice(2)] = value;
  }
  return parsed;
}

export function fingerprintConsumerAuthority(desktopRoot, commit) {
  const records = CONSUMER_AUTHORITY_PATHS.map((path) => ({
    path,
    git_blob_sha1: commandOutput(
      'git',
      commit
        ? ['-C', desktopRoot, 'rev-parse', `${commit}:${path}`]
        : [
            '-C',
            desktopRoot,
            'hash-object',
            `--path=${path}`,
            resolve(desktopRoot, ...path.split('/')),
          ],
    ),
  }));
  return createHash('sha256')
    .update(JSON.stringify(records))
    .digest('hex');
}

export function requiredAbsolutePath(arguments_, name) {
  const value = arguments_[name];
  if (typeof value !== 'string' || !isAbsolute(value)) {
    throw new Error(`--${name} must be an absolute path.`);
  }
  return resolve(value);
}

export function readJson(path) {
  const serialized = readFileSync(path, 'utf8');
  if (serialized.charCodeAt(0) === 0xfeff) {
    throw new Error('JSON files must not contain a byte-order mark.');
  }
  return JSON.parse(serialized);
}

export function hasExactKeys(value, keys) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key)),
  );
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  const value = result.stdout?.trim() ?? '';
  if (result.status !== 0 || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error('Desktop catalog authority could not be fingerprinted.');
  }
  return value;
}
