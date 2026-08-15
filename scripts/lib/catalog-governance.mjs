import { hasExactKeys, isCanonicalTimestamp } from './contracts.mjs';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export function validateCatalogApprovals(approvals, governance, now) {
  const nowMs = validDate(now);
  if (
    governance?.mode !== 'single-maintainer-unanimous' ||
    governance.approval_rule !== 'all-eligible-approvers' ||
    governance.transition !== 'explicit-policy-change' ||
    governance.review_enforcement !== 'advisory' ||
    !Array.isArray(governance.eligible_approvers) ||
    !Array.isArray(approvals) ||
    approvals.length !== governance.eligible_approvers.length
  ) {
    throw new Error('Catalog governance policy is invalid.');
  }
  const identities = new Set();
  for (const approval of approvals) {
    if (
      !hasExactKeys(approval, ['approved_at', 'approver', 'approver_role']) ||
      !isCanonicalTimestamp(approval.approved_at) ||
      Date.parse(approval.approved_at) > nowMs + MAX_CLOCK_SKEW_MS ||
      Date.parse(approval.approved_at) < Date.parse(governance.effective_from) ||
      typeof approval.approver !== 'string' ||
      identities.has(approval.approver)
    ) {
      throw new Error('Catalog approval is invalid.');
    }
    identities.add(approval.approver);
    const eligible = governance.eligible_approvers.find(
      ({ github_login: login }) => login === approval.approver,
    );
    if (!eligible || eligible.role !== approval.approver_role) {
      throw new Error('Catalog approval is not eligible.');
    }
  }
  const missing = governance.eligible_approvers.some(
    ({ github_login: login }) => !identities.has(login),
  );
  if (missing) {
    throw new Error('Catalog approval is not unanimous.');
  }
  return Object.freeze({
    approvalCount: approvals.length,
    reviewOverdue: nowMs >= Date.parse(governance.review_due_at),
  });
}

function validDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new Error('Catalog governance clock is invalid.');
  }
  return value.valueOf();
}
