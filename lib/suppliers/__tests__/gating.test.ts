import test from 'node:test';
import assert from 'node:assert/strict';

import { canDraftProducts, canSubmitProducts } from '../gating.ts';

const approved = {
  onboardingStatus: 'APPROVED' as const,
  status: 'ACTIVE' as const,
  canListProducts: true
};

test('drafting is open while the application is pending', () => {
  assert.deepEqual(canDraftProducts({ status: 'PENDING_REVIEW' }), { allowed: true });
  assert.deepEqual(canDraftProducts({ status: 'ACTIVE' }), { allowed: true });
});

test('drafting is blocked for suspended/blacklisted accounts', () => {
  assert.deepEqual(canDraftProducts({ status: 'SUSPENDED' }), {
    allowed: false,
    reason: 'suspended'
  });
  assert.deepEqual(canDraftProducts({ status: 'BLACKLISTED' }), {
    allowed: false,
    reason: 'blacklisted'
  });
});

test('submitting requires an approved application', () => {
  assert.deepEqual(canSubmitProducts(approved), { allowed: true });
});

test('submitting is blocked at every pre-approval onboarding stage', () => {
  assert.deepEqual(
    canSubmitProducts({ ...approved, onboardingStatus: 'DRAFT' }),
    { allowed: false, reason: 'not_submitted' }
  );
  assert.deepEqual(
    canSubmitProducts({ ...approved, onboardingStatus: 'PENDING' }),
    { allowed: false, reason: 'pending_review' }
  );
  assert.deepEqual(
    canSubmitProducts({ ...approved, onboardingStatus: 'REJECTED' }),
    { allowed: false, reason: 'rejected' }
  );
});

test('approved but listing rights revoked → not_granted', () => {
  assert.deepEqual(canSubmitProducts({ ...approved, canListProducts: false }), {
    allowed: false,
    reason: 'not_granted'
  });
});

test('suspension beats an approved application', () => {
  assert.deepEqual(canSubmitProducts({ ...approved, status: 'SUSPENDED' }), {
    allowed: false,
    reason: 'suspended'
  });
  assert.deepEqual(canSubmitProducts({ ...approved, status: 'BLACKLISTED' }), {
    allowed: false,
    reason: 'blacklisted'
  });
});

test('approved application on a not-yet-active account cannot submit', () => {
  assert.deepEqual(canSubmitProducts({ ...approved, status: 'PENDING_REVIEW' }), {
    allowed: false,
    reason: 'pending_review'
  });
});
