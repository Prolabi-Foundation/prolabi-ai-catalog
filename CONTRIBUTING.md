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
4. Record the unanimous catalog approval required by `policy/catalog-policy.json`. The current eligible set contains only `asnielrod`, so pilot and production candidates require exactly one owner approval.
5. Merge only with required checks green, resolved conversations, a merge commit, and without administrator bypass.

The organization currently has one maintainer. GitHub does not allow the author to approve their own pull request, so the protected source branch requires zero approving reviews while still requiring a pull request, an up-to-date branch, the `validate` check, resolved conversations, and merge commits. Catalog approval is a separate payload-bound record validated against the eligible approvers in policy.

The global governance policy applies equally to owner-pilot, kill-switch and production catalogs. The narrower `owner_pilot` object defines only technical deployment constraints: OpenAI-only scope, exact maximum lifetime of 180 days and one independent verification against current official provider documentation. That verification may be performed by a locally operated review agent and is technical evidence, never another human approval.

The governance policy has a non-blocking review date of 2028-08-14 and continues until replaced by an explicit versioned policy change. Adding collaborators does not silently alter the eligible set or approval rule; update policy deliberately when governance changes.

If repository protection is inactive or a catalog lacks every approval required by the pinned policy, stop before merging or publishing even when CI is green. Repository settings and catalog evidence are complementary gates.

Updating `consumer.commit` is a security-relevant dependency update. Review the Desktop diff between the old and new pins, especially provider catalog schemas, release source, canonical JSON, signature verification, publication policy, and keyring behavior.

Provider IDs and prices are release data, not source files. For every activation, retain an independent technical verification against current official provider documentation in addition to the 1/1 owner approval. Record URLs, access timestamps, currency, units, pricing tier, and any conditions in private evidence. Never infer or reuse stale prices.
