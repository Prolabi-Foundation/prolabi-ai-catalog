# Provider catalog release runbook

Status: infrastructure only. No production key or catalog release is currently authorized.

## 1. Repository controls

Before any key ceremony or release:

1. Keep this repository public.
2. Protect `main`; require the validation workflow, two independent approvals, resolved conversations, and no force pushes or deletion.
3. Restrict release creation and tag mutation to designated maintainers with phishing-resistant MFA.
4. Enable private vulnerability reporting and organization audit logs where the GitHub plan supports them.
5. Decide and add the Foundation-approved license before accepting external contributions.

Repository settings are administrative controls and cannot be enforced only by committed files. Capture their review outside this public repository without personal or credential data.

## 2. Establish product trust

Perform the active/recovery Ed25519 ceremony described by Prolabi Desktop's `docs/PROVIDER_CATALOG_OPERATIONS.md` on separate offline systems. Never place private keys in GitHub, Actions secrets, developer environment variables, shared password managers, tickets, or logs.

Add only reviewed public-key records to Desktop. The recovery key must be trusted but must not sign ordinary releases. Merge and verify the Desktop change before updating `consumer.commit` here to that exact commit.

Public CI must remain green after the consumer pin changes, and Desktop's private CI must validate the synthetic payload from the reviewed catalog-operations commit. The public workflow never receives credentials for the private product repository. A green synthetic contract test proves schema compatibility; it does not prove a production key or release.

## 3. Prepare release data outside Git

Create a new working directory outside both repositories. The payload must use a strictly increasing `YYYY.MM.N` catalog version and a lifetime no longer than 30 days.

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
node D:\trusted-source\prolabi-desktop\desktop\scripts\provider-catalog.mjs sign --payload D:\offline-work\catalog.payload.json --private-key E:\offline-keys\active.pem --key-id provider-active-YYYY-NN --output D:\offline-work\prolabi-provider-model-catalog-YYYY.MM.N.json
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
