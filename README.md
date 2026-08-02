# Prolabi AI Catalog

Public operational repository for Prolabi's signed provider-model catalog. It contains publication policy, verification tooling, CI, and runbooks. It intentionally contains **no production catalog, provider credential, or signing key**.

Prolabi Desktop is the authority for the catalog schema and publication rules. This repository pins an exact Desktop authority in [`policy/catalog-policy.json`](policy/catalog-policy.json), while Desktop's private CI checks out this public repository and validates a synthetic payload. This direction avoids granting a public workflow access to the private product repository, and schema logic is not copied here.

## Current state

- The repository is public and the product remains fail-closed.
- The production keyring in Prolabi Desktop is empty.
- No provider model ID or price has been approved.
- No signed release exists and no external provider call is enabled by this repository.

## Local verification

Requirements: the exact Node version in `.nvmrc` and npm.

```powershell
npm ci
npm test
```

To exercise the real consumer, first build the pinned `prolabi-desktop` checkout, then generate a disposable payload outside both repositories:

```powershell
node scripts/generate-synthetic-payload.mjs --output D:\catalog-work\catalog.payload.json
node scripts/validate-with-desktop.mjs --desktop-dir D:\src\prolabi-desktop --payload D:\catalog-work\catalog.payload.json
```

The consumer checkout must be the pinned commit or a descendant that has not changed any allowlisted catalog-authority path. Update the pin and review the authority diff whenever one of those paths changes.

## Publication boundary

Signed assets are created and reviewed outside Git. Their only supported identity is:

- tag: `provider-model-catalog-v<YYYY.MM.N>`
- single asset: `prolabi-provider-model-catalog-<YYYY.MM.N>.json`
- final, non-prerelease, immutable GitHub Release with a SHA-256 asset digest

Before upload, inspect the signed envelope and extract its payload for canonical Desktop validation:

```powershell
node scripts/inspect-release-candidate.mjs --asset D:\catalog-work\prolabi-provider-model-catalog-2026.08.1.json --tag provider-model-catalog-v2026.08.1 --payload-output D:\catalog-work\review.payload.json
```

This structural inspection does not replace signature verification by Desktop. Follow [`docs/RELEASE_RUNBOOK.md`](docs/RELEASE_RUNBOOK.md) for the full ceremony.

## Governance

Changes must remain small, reviewable, and fail-closed. `main` requires pull requests, an up-to-date branch, this repository's validation workflow, resolved conversations, merge commits, and no force-push or deletion. While the organization has a single maintainer, approving reviews remain temporarily at zero because authors cannot approve their own pull requests; production activation still requires the two independent approvals encoded in policy. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md).

The repository is licensed under [`AGPL-3.0-only`](LICENSE).
