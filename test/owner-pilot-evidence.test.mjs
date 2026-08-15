import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { validateOwnerPilotEvidence } from '../scripts/lib/owner-pilot-evidence.mjs';

const commit = 'a'.repeat(40);
const now = new Date('2026-08-14T18:00:00.000Z');
const policy = Object.freeze({
  owner_pilot: Object.freeze({
    governance_review_due_at: '2027-08-14T00:00:00.000Z',
    kill_switch_publication_mode: 'owner-pilot-disabled',
    publication_mode: 'owner-pilot-openai',
  }),
});

test('owner-pilot evidence binds current independent pricing to exact payload', () => {
  withFixture(({ evidencePath, payloadPath }) => {
    const result = validateOwnerPilotEvidence({
      catalogCommit: commit,
      desktopCommit: commit,
      evidencePath,
      now,
      payloadPath,
      policy,
      publicationMode: 'owner-pilot-openai',
    });
    assert.equal(result.catalogVersion, '2026.08.2');
  });
});

test('owner-pilot activation rejects stale evidence and overdue governance', () => {
  withFixture(({ evidence, evidencePath, payloadPath, writeEvidence }) => {
    evidence.pricing_verification.verified_at = '2026-08-13T17:59:59.999Z';
    writeEvidence();
    assert.throws(
      () => validateOwnerPilotEvidence({
        catalogCommit: commit,
        desktopCommit: commit,
        evidencePath,
        now,
        payloadPath,
        policy,
        publicationMode: 'owner-pilot-openai',
      }),
      /stale/u,
    );
    evidence.pricing_verification.verified_at = '2026-08-14T17:00:00.000Z';
    writeEvidence();
    assert.throws(
      () => validateOwnerPilotEvidence({
        catalogCommit: commit,
        desktopCommit: commit,
        evidencePath,
        now: new Date('2027-08-14T00:00:00.000Z'),
        payloadPath,
        policy,
        publicationMode: 'owner-pilot-openai',
      }),
      /overdue/u,
    );
  });
});

test('owner-pilot evidence rejects price drift but permits kill switch after review expiry', () => {
  withFixture(({ evidence, evidencePath, payloadPath, writeEvidence }) => {
    evidence.pricing_verification.sources[0]
      .input_micros_per_million_tokens += 1;
    writeEvidence();
    assert.throws(
      () => validateOwnerPilotEvidence({
        catalogCommit: commit,
        desktopCommit: commit,
        evidencePath,
        now,
        payloadPath,
        policy,
        publicationMode: 'owner-pilot-openai',
      }),
      /differs/u,
    );
    const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
    payload.models = payload.models.map((model) => ({ ...model, status: 'deprecated' }));
    payload.profiles = [];
    writeFileSync(payloadPath, `${JSON.stringify(payload)}\n`);
    evidence.publication_mode = 'owner-pilot-disabled';
    evidence.purpose = 'kill-switch';
    evidence.max_smoke_cost_micros = 0;
    evidence.pricing_verification = null;
    evidence.payload_sha256 = createHash('sha256')
      .update(readFileSync(payloadPath))
      .digest('hex');
    writeEvidence();
    assert.equal(
      validateOwnerPilotEvidence({
        catalogCommit: commit,
        desktopCommit: commit,
        evidencePath,
        now: new Date('2028-01-01T00:00:00.000Z'),
        payloadPath,
        policy,
        publicationMode: 'owner-pilot-disabled',
      }).purpose,
      'kill-switch',
    );
  });
});

function withFixture(callback) {
  const root = mkdtempSync(resolve(tmpdir(), 'prolabi-owner-evidence-'));
  try {
    const payloadPath = resolve(root, 'payload.json');
    const evidencePath = resolve(root, 'evidence.json');
    const models = ['synthetic-terra', 'synthetic-luna', 'synthetic-sol'].map(
      (id, index) => ({
        id,
        pricing: {
          currency: 'USD',
          input_micros_per_million_tokens: (index + 1) * 100,
          output_micros_per_million_tokens: (index + 1) * 600,
          pricing_mode: 'standard',
        },
        provider: 'openai',
        status: 'active',
      }),
    );
    const payload = {
      catalog_version: '2026.08.2',
      models,
      profiles: models.map((model) => ({ model_id: model.id })),
    };
    writeFileSync(payloadPath, `${JSON.stringify(payload)}\n`);
    const evidence = {
      active_key: {
        fingerprint_sha256: 'b'.repeat(64),
        key_id: 'provider-active-2026-01',
      },
      catalog_operations_commit: commit,
      catalog_version: payload.catalog_version,
      desktop_commit: commit,
      format: 'prolabi-owner-pilot-release-evidence',
      format_version: 1,
      max_smoke_cost_micros: 30_000,
      owner_approval: {
        approved_at: '2026-08-14T17:30:00.000Z',
        approver: 'repository-owner',
      },
      payload_sha256: createHash('sha256')
        .update(readFileSync(payloadPath))
        .digest('hex'),
      pricing_verification: {
        sources: models.map((model) => ({
          accessed_at: '2026-08-14T17:00:00.000Z',
          conditions: ['standard text-token pricing'],
          currency: 'USD',
          input_micros_per_million_tokens:
            model.pricing.input_micros_per_million_tokens,
          model_id: model.id,
          output_micros_per_million_tokens:
            model.pricing.output_micros_per_million_tokens,
          pricing_mode: 'standard',
          provider: 'openai',
          source_url: `https://developers.openai.com/api/docs/models/${model.id}`,
          unit: 'per-million-tokens',
        })),
        verified_at: '2026-08-14T17:15:00.000Z',
        verifier_type: 'independent-review-agent',
      },
      publication_mode: 'owner-pilot-openai',
      purpose: 'activation',
    };
    const writeEvidence = () =>
      writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`);
    writeEvidence();
    callback({ evidence, evidencePath, payloadPath, writeEvidence });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}
