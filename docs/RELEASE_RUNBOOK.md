# Provider catalog release runbook

Status: infrastructure only. No production key or catalog release is currently authorized.

The owner-only OpenAI pilot is a separate, temporary deployment mode. It does not satisfy or weaken the production gate described below.

## Owner-only OpenAI pilot

The repository owner may approve a pilot candidate after recording the exact Desktop commit, catalog version, public-key fingerprints, source URLs and timestamps for model/pricing review, payload SHA-256, maximum approved smoke cost, and cleanup result. A single-maintainer pilot also requires one independent verification record against current official provider documentation; a locally operated review agent may produce that evidence, but it does not count as a production approval. Evidence must use `prolabi-owner-pilot-release-evidence` version 1, remain outside Git and the Release, match the exact payload bytes and be less than 24 hours old. New activations fail closed when the annual `governance_review_due_at` is reached; the kill switch remains available without a pricing review. The candidate must contain only the three OpenAI descriptors accepted by Desktop's `owner-pilot-openai` publication mode and must expire within exactly 180 days or less. At the 2026-08-14 verification, the official model pages list [Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna) (`gpt-5.6-luna`) at USD 0.20/1.20, [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) (`gpt-5.6-terra`) at USD 2/12, and [Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) (`gpt-5.6-sol`) at USD 5/30 per million standard input/output tokens; re-check those pages immediately before every candidate because the signed payload, not this prose, is the billable authority.

Desktop may temporarily provide an unpackaged, ephemeral trust harness for local
solo development. Its keys and catalog are generated in memory, use disposable
Desktop state, never enter this repository or a GitHub Release, and are not valid
publication or smoke evidence. Packaged Desktop ignores that harness. Remove it
from Desktop before the first public release; this runbook remains the only path
to an owner-pilot or production catalog release.

Validate and sign with the explicit mode:

```powershell
node D:\trusted-source\prolabi-desktop\desktop\scripts\generate-owner-pilot-provider-catalog.mjs --catalog-version YYYY.MM.N --validity-days 180 --output D:\offline-work\pilot.payload.json
node scripts\validate-with-desktop.mjs --desktop-dir D:\src\prolabi-desktop --payload D:\catalog-work\pilot.payload.json --publication-mode owner-pilot-openai --evidence D:\catalog-work\owner-pilot.evidence.json
node D:\trusted-source\prolabi-desktop\desktop\scripts\provider-catalog.mjs sign --payload D:\offline-work\pilot.payload.json --publication-mode owner-pilot-openai --private-key E:\offline-keys\active.pem --prompt-private-key-passphrase --key-id provider-active-YYYY-NN --output D:\offline-work\prolabi-provider-model-catalog-YYYY.MM.N.json
```

The active and recovery private keys must be created on separate offline systems and kept on separately encrypted offline media. Only their reviewed public-key records enter Desktop. Never create either private key on a development workstation or in CI.

The pilot smoke is OpenAI-only, owner-only, single-run, no-retry after `outcome_unknown`, and capped at USD 0.03. Disable access, remove the test credential, and retain only redacted evidence afterward. A signed `owner-pilot-disabled` candidate with the same three descriptors deprecated and no profiles is the emergency kill switch. Production still requires the nine-model review and two independent approvals in the remaining sections.

## 1. Repository controls

Before any key ceremony or release:

1. Keep this repository public.
2. Protect `main`; require the validation workflow, two independent approvals, resolved conversations, and no force pushes or deletion.
3. Restrict release creation and tag mutation to designated maintainers with phishing-resistant MFA.
4. Enable private vulnerability reporting and organization audit logs where the GitHub plan supports them.
5. Confirm GitHub identifies the repository license as `AGPL-3.0-only`.

Repository settings are administrative controls and cannot be enforced only by committed files. Capture their review outside this public repository without personal or credential data.

Do not perform the key ceremony while any of these settings remains unverified. A maintainer with repository-administration access must record the settings review privately; local tooling and CI intentionally cannot claim that external state.

## 2. Establish product trust

Perform the active/recovery Ed25519 ceremony described by Prolabi Desktop's `docs/PROVIDER_CATALOG_OPERATIONS.md` on separate offline systems. Never place private keys in GitHub, Actions secrets, developer environment variables, shared password managers, tickets, or logs.

Add only reviewed public-key records to Desktop. The recovery key must be trusted but must not sign ordinary releases. Commit and review the Desktop authority change, then update `consumer.commit` here to that exact authority commit and record its committed-blob fingerprint. Merge this operational update before advancing Desktop's immutable catalog-operations source pin; only then may the Desktop change merge with its private CI green.

Public CI must remain green after the consumer authority changes, and Desktop's private CI must validate the synthetic payload from the reviewed catalog-operations commit. For a coordinated change, record `consumer.authority_sha256` from `npm run consumer:fingerprint -- --desktop-dir <absolute Desktop path>` only after reviewing the complete authority diff; Desktop CI later recomputes it from committed Git blobs. This avoids a circular future-commit pin without allowing arbitrary descendants. The public workflow never receives credentials for the private product repository. A green synthetic contract test proves schema compatibility; it does not prove a production key or release.

## 3. Prepare release data outside Git

Create a new working directory outside both repositories. The payload must use a strictly increasing `YYYY.MM.N` catalog version and a lifetime no longer than exactly 180 days.

For each of the nine initial mappings, two reviewers independently verify against current official provider documentation:

- exact API model ID and availability;
- API contract supported by Desktop;
- input and output token limits;
- standard USD input/output token prices and their units;
- absence of tool, file, URL, background, or remote-conversation requirements.

Record sources and timestamps in private, redacted release evidence. Do not manufacture missing values. Any ambiguity blocks that descriptor.

Build the pinned Desktop consumer and validate the external payload:

```powershell
Set-Location D:\src\prolabi-desktop\desktop
npm ci
npm run build
node scripts\provider-catalog.mjs validate --payload D:\catalog-work\catalog.payload.json
```

## 4. Sign offline

Transfer only the reviewed payload to the active-key system. Sign using the canonical Desktop tool from the same pinned source commit. Keep the private-key file outside every repository and create a new output rather than overwriting an old asset.

```powershell
node D:\trusted-source\prolabi-desktop\desktop\scripts\provider-catalog.mjs sign --payload D:\offline-work\catalog.payload.json --private-key E:\offline-keys\active.pem --prompt-private-key-passphrase --key-id provider-active-YYYY-NN --output D:\offline-work\prolabi-provider-model-catalog-YYYY.MM.N.json
```

Return only the signed asset. Securely clear the temporary offline working copy according to the Foundation's key-handling policy.

## 5. Inspect and publish

On the publication system, inspect the candidate and extract a new review copy:

```powershell
node scripts\inspect-release-candidate.mjs --asset D:\catalog-work\prolabi-provider-model-catalog-YYYY.MM.N.json --tag provider-model-catalog-vYYYY.MM.N --payload-output D:\catalog-work\review.payload.json
node scripts\validate-with-desktop.mjs --desktop-dir D:\src\prolabi-desktop --payload D:\catalog-work\review.payload.json
```

Compare the reported SHA-256 between two reviewers. Create a draft release with the exact tag and exactly one asset. Confirm the uploaded asset's GitHub digest and size match before making the release final and immutable. Desktop rejects drafts, prereleases, mutable releases, missing digests, additional/mismatched assets, invalid signatures, and version drift.

Do not republish altered bytes under an existing version. Recovery uses a higher catalog version or a Desktop keyring revocation, never release mutation.

## 6. Activate and close evidence

From a clean packaged Desktop install with no credentials:

1. Refresh and verify version, expiry, key ID, payload hash, and absence of broker execution.
2. Run negative checks for rollback, unknown key, altered asset, bad digest, mutable release, and expired catalog.
3. Execute the capped manual paid smoke for OpenAI, Anthropic, and Gemini using separate low-limit test credentials, as defined in Desktop operations documentation.
4. Complete Windows/macOS packaging and the AI-2 exit evidence against the same clean source commit, candidate, and catalog.
5. Remove test credentials and disable external-provider access after validation.

No retry is allowed after an `outcome_unknown`. Any price ambiguity, model mismatch, budget breach, secret leakage, or unredacted evidence blocks activation.

## Emergency response

- Suspected private-key exposure: stop publication, treat the key as compromised, publish no catalog with it, and ship a reviewed Desktop revocation using the still-trusted recovery path.
- Bad catalog with intact trust: publish a strictly higher corrective version signed by a trusted key.
- GitHub/repository compromise: disable product access, preserve audit evidence privately, and restore trust through a Desktop release; do not rely on deleting or rewriting the compromised release.
- Provider contract or price uncertainty: let the catalog expire or publish a higher version that deprecates the affected model. Fail closed.
