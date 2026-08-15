import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { hasExactKeys, isCanonicalTimestamp, readJson } from './contracts.mjs';
import { validateCatalogApprovals } from './catalog-governance.mjs';

const EVIDENCE_FORMAT = 'prolabi-owner-pilot-release-evidence';
const MAX_PRICE_REVIEW_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export function validateOwnerPilotEvidence(options) {
  const payloadBytes = readFileSync(options.payloadPath);
  const payload = JSON.parse(payloadBytes.toString('utf8'));
  const evidence = readJson(options.evidencePath);
  const nowMs = validDate(options.now, 'Owner-pilot evidence clock is invalid.');
  const isActivation =
    options.publicationMode === options.policy.owner_pilot.publication_mode;
  const isKillSwitch =
    options.publicationMode ===
    options.policy.owner_pilot.kill_switch_publication_mode;
  if (!isActivation && !isKillSwitch) {
    throw new Error('Owner-pilot evidence mode is invalid.');
  }
  if (
    !hasExactKeys(evidence, [
      'active_key',
      'approvals',
      'catalog_operations_commit',
      'catalog_version',
      'desktop_commit',
      'format',
      'format_version',
      'max_smoke_cost_micros',
      'payload_sha256',
      'pricing_verification',
      'publication_mode',
      'purpose',
    ]) ||
    evidence.format !== EVIDENCE_FORMAT ||
    evidence.format_version !== 2 ||
    evidence.publication_mode !== options.publicationMode ||
    evidence.purpose !== (isActivation ? 'activation' : 'kill-switch') ||
    evidence.catalog_version !== payload.catalog_version ||
    evidence.desktop_commit !== options.desktopCommit ||
    evidence.catalog_operations_commit !== options.catalogCommit ||
    !COMMIT_PATTERN.test(evidence.desktop_commit) ||
    !COMMIT_PATTERN.test(evidence.catalog_operations_commit) ||
    evidence.payload_sha256 !==
      createHash('sha256').update(payloadBytes).digest('hex') ||
    !SHA256_PATTERN.test(evidence.payload_sha256) ||
    !validActiveKey(evidence.active_key) ||
    evidence.max_smoke_cost_micros !== (isActivation ? 30_000 : 0)
  ) {
    throw new Error('Owner-pilot release evidence is invalid.');
  }
  const governance = validateCatalogApprovals(
    evidence.approvals,
    options.policy.governance,
    options.now,
  );
  if (isActivation) {
    validatePricingVerification(evidence.pricing_verification, payload, nowMs);
  } else if (evidence.pricing_verification !== null) {
    throw new Error('Kill-switch evidence must not depend on pricing review.');
  }
  return Object.freeze({
    catalogVersion: evidence.catalog_version,
    payloadSha256: evidence.payload_sha256,
    purpose: evidence.purpose,
    governanceReviewOverdue: governance.reviewOverdue,
  });
}

function validActiveKey(value) {
  return Boolean(
    hasExactKeys(value, ['fingerprint_sha256', 'key_id']) &&
      SHA256_PATTERN.test(value.fingerprint_sha256) &&
      /^[a-z0-9][a-z0-9._-]{1,95}$/u.test(value.key_id),
  );
}

function validatePricingVerification(value, payload, nowMs) {
  if (
    !hasExactKeys(value, ['sources', 'verified_at', 'verifier_type']) ||
    value.verifier_type !== 'independent-review-agent' ||
    !isCanonicalTimestamp(value.verified_at) ||
    !Array.isArray(value.sources)
  ) {
    throw new Error('Independent pricing verification is invalid.');
  }
  const verifiedAtMs = Date.parse(value.verified_at);
  if (
    verifiedAtMs > nowMs + MAX_CLOCK_SKEW_MS ||
    nowMs - verifiedAtMs > MAX_PRICE_REVIEW_AGE_MS
  ) {
    throw new Error('Independent pricing verification is stale.');
  }
  const models = Array.isArray(payload.models) ? payload.models : [];
  if (value.sources.length !== models.length) {
    throw new Error('Independent pricing verification is incomplete.');
  }
  const sourcesByModel = new Map();
  for (const source of value.sources) {
    if (
      !hasExactKeys(source, [
        'accessed_at',
        'conditions',
        'currency',
        'input_micros_per_million_tokens',
        'model_id',
        'output_micros_per_million_tokens',
        'pricing_mode',
        'provider',
        'source_url',
        'unit',
      ]) ||
      source.provider !== 'openai' ||
      source.currency !== 'USD' ||
      source.pricing_mode !== 'standard' ||
      source.unit !== 'per-million-tokens' ||
      !Array.isArray(source.conditions) ||
      !source.conditions.every(
        (condition) => typeof condition === 'string' && condition.length > 0,
      ) ||
      !isCanonicalTimestamp(source.accessed_at) ||
      Date.parse(source.accessed_at) > verifiedAtMs + MAX_CLOCK_SKEW_MS ||
      verifiedAtMs - Date.parse(source.accessed_at) > MAX_PRICE_REVIEW_AGE_MS ||
      source.source_url !==
        `https://developers.openai.com/api/docs/models/${source.model_id}` ||
      sourcesByModel.has(source.model_id)
    ) {
      throw new Error('Independent pricing source is invalid.');
    }
    sourcesByModel.set(source.model_id, source);
  }
  for (const model of models) {
    const source = sourcesByModel.get(model.id);
    if (
      !source ||
      model.provider !== source.provider ||
      model.pricing?.currency !== source.currency ||
      model.pricing?.pricing_mode !== source.pricing_mode ||
      model.pricing?.input_micros_per_million_tokens !==
        source.input_micros_per_million_tokens ||
      model.pricing?.output_micros_per_million_tokens !==
        source.output_micros_per_million_tokens
    ) {
      throw new Error('Independent pricing verification differs from payload.');
    }
  }
}

function validDate(value, message) {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new Error(message);
  }
  return value.valueOf();
}
