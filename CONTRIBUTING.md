# Contributing

Contributions are accepted under the repository's [`AGPL-3.0-only`](LICENSE) license.

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
4. Record the repository owner's review in the pull request and obtain two independent approvals for any production key, catalog release, pricing, or trust-boundary activation.
5. Merge only with required checks green, resolved conversations, a merge commit, and without administrator bypass.

The organization currently has one maintainer. GitHub does not allow the author to approve their own pull request, so the protected source branch temporarily requires zero approving reviews while still requiring a pull request, an up-to-date branch, the `validate` check, resolved conversations, and merge commits. This documented source-governance exception does not satisfy `publication.minimum_independent_approvals`, does not authorize a key ceremony or provider release, and must be replaced with two required independent approvals as soon as a second maintainer is available.

If the required protection is not active, or a production activation lacks the two independent approvals required by policy, stop before merging or publishing even when CI is green. Repository settings are an external activation gate; committed policy cannot substitute for GitHub enforcement.

Updating `consumer.commit` is a security-relevant dependency update. Review the Desktop diff between the old and new pins, especially provider catalog schemas, release source, canonical JSON, signature verification, publication policy, and keyring behavior.

Provider IDs and prices are release data, not source files. During a release review, two people must compare them with current official provider documentation and record URLs, access timestamps, currency, units, pricing tier, and any conditions in private evidence. Never infer or reuse stale prices.
