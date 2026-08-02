import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import {
  hasExactKeys,
  loadPolicy,
  parseArguments,
  requiredAbsolutePath,
} from './lib/contracts.mjs';

const policy = loadPolicy();
const arguments_ = parseArguments(process.argv.slice(2), [
  'asset',
  'payload-output',
  'tag',
]);
const assetPath = requiredAbsolutePath(arguments_, 'asset');
const tag = arguments_.tag;
if (typeof tag !== 'string') {
  throw new Error('--tag is required.');
}
const match = /^provider-model-catalog-v([0-9]{4}\.[0-9]{2}\.[0-9]+)$/u.exec(
  tag,
);
if (!match) {
  throw new Error('Release tag is invalid.');
}
const catalogVersion = match[1];
const expectedAssetName = `prolabi-provider-model-catalog-${catalogVersion}.json`;
if (basename(assetPath) !== expectedAssetName) {
  throw new Error('Release asset name does not match its tag.');
}

const bytes = readFileSync(assetPath);
if (bytes.length === 0 || bytes.length > policy.release.max_asset_bytes) {
  throw new Error('Release asset size is invalid.');
}
const serialized = bytes.toString('utf8');
if (serialized.charCodeAt(0) === 0xfeff) {
  throw new Error('Release asset must not contain a byte-order mark.');
}
const envelope = JSON.parse(serialized);
if (
  !hasExactKeys(envelope, [
    'algorithm',
    'format',
    'format_version',
    'key_id',
    'payload',
    'signature',
  ]) ||
  envelope.algorithm !== 'Ed25519' ||
  envelope.format !== 'prolabi-provider-model-catalog-envelope' ||
  envelope.format_version !== 1 ||
  typeof envelope.key_id !== 'string' ||
  !/^[a-z0-9][a-z0-9._-]{1,95}$/u.test(envelope.key_id) ||
  typeof envelope.signature !== 'string' ||
  !/^[A-Za-z0-9_-]{86}$/u.test(envelope.signature) ||
  !envelope.payload ||
  envelope.payload.catalog_version !== catalogVersion
) {
  throw new Error('Release envelope identity is invalid.');
}

if (arguments_['payload-output'] !== undefined) {
  const payloadOutput = requiredAbsolutePath(arguments_, 'payload-output');
  if (existsSync(payloadOutput)) {
    throw new Error('Payload output already exists.');
  }
  writeFileSync(payloadOutput, `${JSON.stringify(envelope.payload, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
}

process.stdout.write(
  `${JSON.stringify({
    asset: expectedAssetName,
    bytes: bytes.length,
    catalog_version: catalogVersion,
    key_id: envelope.key_id,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })}\n`,
);
