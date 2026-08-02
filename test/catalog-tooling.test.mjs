import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  fingerprintConsumerAuthority,
  loadPolicy,
  REPOSITORY_ROOT,
} from '../scripts/lib/contracts.mjs';

test('policy pins the canonical Desktop consumer and fail-closed release shape', () => {
  const policy = loadPolicy();
  assert.equal(policy.consumer.commit.length, 40);
  assert.equal(policy.consumer.validation_mode, 'pinned-or-authority-equivalent');
  assert.equal(policy.consumer.authority_paths.length, 15);
  assert.match(policy.consumer.authority_sha256, /^[0-9a-f]{64}$/u);
  assert.ok(
    policy.consumer.authority_paths.includes(
      'desktop/src/providerCatalogTrustedKeys.json',
    ),
  );
  assert.equal(policy.release.exact_asset_count, 1);
  assert.equal(policy.release.require_final, true);
  assert.equal(policy.release.require_immutable, true);
  assert.equal(policy.publication.allow_catalog_payloads_in_git, false);
  assert.equal(policy.publication.allow_private_keys_in_git_or_ci, false);
  assert.equal(policy.publication.minimum_independent_approvals, 2);
  assert.deepEqual(policy.owner_pilot.allowed_providers, ['openai']);
  assert.equal(
    policy.owner_pilot.kill_switch_publication_mode,
    'owner-pilot-disabled',
  );
  assert.equal(policy.owner_pilot.max_catalog_lifetime_days, 7);
  assert.equal(policy.owner_pilot.minimum_owner_approvals, 1);
  assert.equal(policy.owner_pilot.publication_mode, 'owner-pilot-openai');
});

test('synthetic payload is created exclusively and contains no production IDs', () => {
  withTemporaryDirectory((directory) => {
    const output = resolve(directory, 'catalog.payload.json');
    run('scripts/generate-synthetic-payload.mjs', ['--output', output]);
    const payload = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(payload.models.length, 9);
    assert.equal(payload.profiles.length, 9);
    assert.ok(payload.models.every((model) => model.id.startsWith('synthetic-')));

    const second = spawn('scripts/generate-synthetic-payload.mjs', [
      '--output',
      output,
    ]);
    assert.notEqual(second.status, 0);
  });
});

test('consumer authority fingerprint binds exact Git blobs before and after commit', () => {
  withTemporaryDirectory((directory) => {
    const policy = loadPolicy();
    runCommand('git', ['init', '--initial-branch=main'], directory);
    runCommand('git', ['config', 'user.email', 'catalog-test@prolabi.invalid'], directory);
    runCommand('git', ['config', 'user.name', 'Catalog Test'], directory);
    for (const path of policy.consumer.authority_paths) {
      const file = resolve(directory, ...path.split('/'));
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, `${path}\n`);
    }
    const workingFingerprint = fingerprintConsumerAuthority(directory);
    runCommand('git', ['add', '.'], directory);
    runCommand('git', ['commit', '-m', 'fixture'], directory);
    const commit = runCommand('git', ['rev-parse', 'HEAD'], directory).trim();
    assert.equal(
      fingerprintConsumerAuthority(directory, commit),
      workingFingerprint,
    );
    writeFileSync(
      resolve(directory, ...policy.consumer.authority_paths[0].split('/')),
      'drift\n',
    );
    assert.notEqual(fingerprintConsumerAuthority(directory), workingFingerprint);
  });
});

test('release inspector binds tag, filename, payload version, and digest', () => {
  withTemporaryDirectory((directory) => {
    const payloadPath = resolve(directory, 'catalog.payload.json');
    run('scripts/generate-synthetic-payload.mjs', ['--output', payloadPath]);
    const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
    const assetPath = resolve(
      directory,
      'prolabi-provider-model-catalog-2026.08.1.json',
    );
    writeFileSync(
      assetPath,
      `${JSON.stringify({
        algorithm: 'Ed25519',
        format: 'prolabi-provider-model-catalog-envelope',
        format_version: 1,
        key_id: 'synthetic-test-key',
        payload,
        signature: 'A'.repeat(86),
      })}\n`,
    );
    const extracted = resolve(directory, 'extracted.payload.json');
    const result = JSON.parse(
      run('scripts/inspect-release-candidate.mjs', [
        '--asset',
        assetPath,
        '--tag',
        'provider-model-catalog-v2026.08.1',
        '--payload-output',
        extracted,
      ]),
    );
    assert.equal(result.catalog_version, '2026.08.1');
    assert.match(result.sha256, /^[0-9a-f]{64}$/u);
    assert.deepEqual(JSON.parse(readFileSync(extracted, 'utf8')), payload);

    const mismatched = spawn('scripts/inspect-release-candidate.mjs', [
      '--asset',
      assetPath,
      '--tag',
      'provider-model-catalog-v2026.08.2',
    ]);
    assert.notEqual(mismatched.status, 0);
  });
});

test('release inspector rejects envelope surface drift', () => {
  withTemporaryDirectory((directory) => {
    const assetPath = resolve(
      directory,
      'prolabi-provider-model-catalog-2026.08.1.json',
    );
    writeFileSync(
      assetPath,
      JSON.stringify({
        algorithm: 'Ed25519',
        extra: true,
        format: 'prolabi-provider-model-catalog-envelope',
        format_version: 1,
        key_id: 'synthetic-test-key',
        payload: { catalog_version: '2026.08.1' },
        signature: 'A'.repeat(86),
      }),
    );
    const result = spawn('scripts/inspect-release-candidate.mjs', [
      '--asset',
      assetPath,
      '--tag',
      'provider-model-catalog-v2026.08.1',
    ]);
    assert.notEqual(result.status, 0);
  });
});

function run(script, arguments_) {
  return execFileSync(process.execPath, [resolve(REPOSITORY_ROOT, script), ...arguments_], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });
}
function spawn(script, arguments_) {
  return spawnSync(
    process.execPath,
    [resolve(REPOSITORY_ROOT, script), ...arguments_],
    { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
  );
}

function runCommand(command, arguments_, cwd) {
  return execFileSync(command, arguments_, { cwd, encoding: 'utf8' });
}

function withTemporaryDirectory(callback) {
  const directory = mkdtempSync(resolve(tmpdir(), 'prolabi-ai-catalog-'));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
