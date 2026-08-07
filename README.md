# Prolabi AI Catalog

Public operational repository for Prolabi's signed provider-model catalog. It contains publication policy, verification tooling, CI, and runbooks. It intentionally contains **no production catalog, provider credential, or signing key**.

Prolabi Desktop is the authority for the catalog schema and publication rules. This repository pins an ancestor Desktop commit plus a canonical SHA-256 over the exact Git blobs that form that authority in [`policy/catalog-policy.json`](policy/catalog-policy.json), while Desktop's private CI checks out this public repository and validates a synthetic payload. The blob fingerprint permits a coordinated catalog/consumer update without a circular future-commit reference, but rejects any unreviewed authority drift. This direction avoids granting a public workflow access to the private product repository, and schema logic is not copied here.

## Current state

- The repository is public and the product remains fail-closed.
- Prolabi Desktop contains one reviewed active and one reviewed recovery public
  trust root for the owner-only pilot; their private keys remain offline and
  outside both repositories.
- The owner-only OpenAI pilot pins three reviewed aliases, IDs, prices, and a seven-day maximum lifetime in the Desktop consumer policy.
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

Owner-pilot candidates must opt into the narrower consumer mode:

```powershell
node scripts/validate-with-desktop.mjs --desktop-dir D:\src\prolabi-desktop --payload D:\catalog-work\catalog.payload.json --publication-mode owner-pilot-openai
```

The consumer checkout must be the pinned commit or a descendant whose authority fingerprint exactly matches policy. Before a coordinated update, calculate the reviewed working-tree fingerprint with `npm run consumer:fingerprint -- --desktop-dir D:\src\prolabi-desktop`; after Desktop commits, the validator recomputes the same value from committed Git blobs. Update the ancestor pin and fingerprint only after reviewing every authority-path diff. Merge this operational update before advancing Desktop's immutable catalog-operations source pin; the later source-pin commit is allowed only while the reviewed authority fingerprint remains unchanged.

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

## Owner-only pilot boundary

The temporary pilot is limited to the repository owner and OpenAI. It requires one recorded owner approval, a maximum seven-day catalog lifetime, two offline-created trust roots in Desktop (active and recovery), and a catalog signed by the active key. This is a deployment scope, not a production-governance waiver: production publication continues to require two independent approvals and all three provider families.

Publishing a signed catalog with the same three descriptors marked `deprecated` and no profile mappings is the pilot kill switch. Desktop treats that verified shape as suspended and disables broker access.

## Governance

Changes must remain small, reviewable, and fail-closed. `main` requires pull requests, an up-to-date branch, this repository's validation workflow, resolved conversations, merge commits, and no force-push or deletion. While the organization has a single maintainer, approving reviews remain temporarily at zero because authors cannot approve their own pull requests; production activation still requires the two independent approvals encoded in policy. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md).

The repository is licensed under [`AGPL-3.0-only`](LICENSE).
