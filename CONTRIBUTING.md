# Contributing

## Boundaries

This repository owns release governance and publication tooling. Prolabi Desktop owns the schema, signature verification, anti-rollback behavior, provider adapters, and trusted public keyring.

Do not commit:

- production or synthetic catalog payloads;
- signed release assets;
- private or public test keys masquerading as production trust;
- provider credentials, responses, remote request IDs, or unredacted smoke evidence;
- duplicated schema validators from Desktop.

## Change process

1. Branch from protected `main` and keep the change narrowly scoped.
2. Run `npm ci` and `npm test`.
3. Confirm public CI passes and the private Desktop CI validates a synthetic payload from the exact catalog-operations commit.
4. Obtain two independent approvals for policy, consumer-pin, release, or trust-boundary changes.
5. Merge only with required checks green and without administrator bypass.

Updating `consumer.commit` is a security-relevant dependency update. Review the Desktop diff between the old and new pins, especially provider catalog schemas, release source, canonical JSON, signature verification, publication policy, and keyring behavior.

Provider IDs and prices are release data, not source files. During a release review, two people must compare them with current official provider documentation and record URLs, access timestamps, currency, units, pricing tier, and any conditions in private evidence. Never infer or reuse stale prices.
