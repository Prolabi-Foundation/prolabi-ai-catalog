import { writeFileSync } from 'node:fs';

import {
  parseArguments,
  requiredAbsolutePath,
} from './lib/contracts.mjs';

const arguments_ = parseArguments(process.argv.slice(2), ['output']);
const outputPath = requiredAbsolutePath(arguments_, 'output');

const modelDefinitions = [
  ['anthropic', 'efficient', 'Haiku 4.5'],
  ['anthropic', 'balanced', 'Sonnet 5'],
  ['anthropic', 'highest_quality', 'Fable 5'],
  ['gemini', 'efficient', 'Gemini 3.5 Flash Lite'],
  ['gemini', 'balanced', 'Gemini 3.5 Flash'],
  ['gemini', 'highest_quality', 'Gemini 3.6 Flash'],
  ['openai', 'efficient', 'Luna'],
  ['openai', 'balanced', 'Terra'],
  ['openai', 'highest_quality', 'Sol'],
];

const models = modelDefinitions.map(([provider, profile, displayName]) => ({
  api_contract: `${provider}-${
    provider === 'anthropic'
      ? 'messages'
      : provider === 'gemini'
        ? 'interactions'
        : 'responses'
  }-v1`,
  capabilities: { streaming: true, text: true, tools: false },
  display_name: displayName,
  id: `synthetic-${provider}-${profile.replace('_', '-')}`,
  limits: { context_tokens: 32_000, max_output_tokens: 4_096 },
  pricing: {
    currency: 'USD',
    input_micros_per_million_tokens: 1,
    output_micros_per_million_tokens: 1,
    pricing_mode: 'standard',
  },
  provider,
  status: 'active',
}));

const payload = {
  catalog_version: '2026.08.1',
  expires_at: '2026-08-31T00:00:00.000Z',
  format: 'prolabi-provider-model-catalog',
  format_version: 2,
  minimum_app_version: '0.1.0',
  models,
  profiles: modelDefinitions.map(([provider, profile], index) => ({
    model_id: models[index].id,
    profile,
    provider,
  })),
  published_at: '2026-08-01T00:00:00.000Z',
};

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});
process.stdout.write(`Synthetic catalog payload written to ${outputPath}.\n`);
