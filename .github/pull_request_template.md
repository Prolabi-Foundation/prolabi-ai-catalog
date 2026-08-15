## Scope

Describe the operational policy or tooling change. Catalog payloads and release assets do not belong in Git.

## Required review

- [ ] CI validates this repository and the pinned Desktop consumer.
- [ ] No private key, credential, production payload, signed asset, or provider response is included.
- [ ] Model IDs, limits, contracts, and prices are unchanged, or their official sources are recorded for the release review.
- [ ] Catalog publication evidence records every approval required by the current unanimous governance policy (currently 1/1).
- [ ] Security-sensitive behavior remains fail-closed.
