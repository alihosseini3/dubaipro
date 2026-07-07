import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertTransitionPermission,
  RfqPermissionError,
  type TransitionActor,
} from '../permissions.ts';

const OWNER = 'buyer-1';
const OTHER = 'buyer-2';

const buyer = (id = OWNER, flags?: string[]): TransitionActor => ({ id, role: 'buyer', flags });
const admin: TransitionActor = { id: 'admin-1', role: 'admin' };
const supplier: TransitionActor = { id: 'sup-1', role: 'supplier' };
const system: TransitionActor = { id: 'system', role: 'system' };

test('system actor bypasses all permission checks', () => {
  assert.doesNotThrow(() => assertTransitionPermission('OPEN', 'EXPIRED', system, OWNER));
  assert.doesNotThrow(() => assertTransitionPermission('PENDING_REVIEW', 'OPEN', system, OWNER));
});

test('owner buyer can submit a draft for review', () => {
  assert.doesNotThrow(() =>
    assertTransitionPermission('DRAFT', 'PENDING_REVIEW', buyer(OWNER), OWNER)
  );
});

test('non-owner buyer cannot submit someone else’s draft', () => {
  assert.throws(
    () => assertTransitionPermission('DRAFT', 'PENDING_REVIEW', buyer(OTHER), OWNER),
    RfqPermissionError
  );
});

test('buyer cannot self-publish without TRUSTED_BUYER flag', () => {
  assert.throws(
    () => assertTransitionPermission('DRAFT', 'OPEN', buyer(OWNER), OWNER),
    RfqPermissionError
  );
});

test('buyer with TRUSTED_BUYER flag can self-publish', () => {
  assert.doesNotThrow(() =>
    assertTransitionPermission('DRAFT', 'OPEN', buyer(OWNER, ['TRUSTED_BUYER']), OWNER)
  );
});

test('admin can approve a pending RFQ', () => {
  assert.doesNotThrow(() =>
    assertTransitionPermission('PENDING_REVIEW', 'OPEN', admin, OWNER)
  );
  assert.doesNotThrow(() =>
    assertTransitionPermission('PENDING_REVIEW', 'CANCELLED', admin, OWNER)
  );
});

test('supplier cannot drive RFQ-level transitions', () => {
  assert.throws(
    () => assertTransitionPermission('OPEN', 'CANCELLED', supplier, OWNER),
    RfqPermissionError
  );
});

test('undefined transition rules are denied', () => {
  assert.throws(
    () => assertTransitionPermission('CLOSED', 'OPEN', admin, OWNER),
    RfqPermissionError
  );
});
