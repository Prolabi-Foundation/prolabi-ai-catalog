import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { loadPolicy, REPOSITORY_ROOT } from '../scripts/lib/contracts.mjs';

test('policy pins the canonical Desktop consumer and fail-closed release shape', () => {
  const policy = loadPolicy();
  assert.equal(policy.consumer.commit.length, 40);
  assert.equal(policy.release.exact_asset_count, 1);
  assert.equal(policy.release.require_final, true);
  assert.equal(policy.release.require_immutable, true);
  assert.equal(policy.publication.allow_catalog_payloads_in_git, false);
  assert.equal(policy.publication.allow_private_keys_in_git_or_ci, false);
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

function withTemporaryDirectory(callback) {
  const directory = mkdtempSync(resolve(tmpdir(), 'prolabi-ai-catalog-'));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
