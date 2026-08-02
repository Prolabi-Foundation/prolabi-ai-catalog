import { appendFileSync } from 'node:fs';

import { loadPolicy } from './lib/contracts.mjs';

const policy = loadPolicy();
const output = [
  `consumer_repository=${policy.consumer.repository}`,
  `consumer_commit=${policy.consumer.commit}`,
  `node_version=${policy.consumer.node_version}`,
].join('\n');

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`, 'utf8');
} else {
  process.stdout.write(`${output}\n`);
}
