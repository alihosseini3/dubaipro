import test from 'node:test';
import assert from 'node:assert/strict';

import { checkTransition, availableActions } from '../workflow.ts';

test('supplier can submit from DRAFT and REJECTED only', () => {
  assert.equal(checkTransition('submit', 'DRAFT', 'supplier').ok, true);
  assert.equal(checkTransition('submit', 'REJECTED', 'supplier').ok, true);
  assert.equal(checkTransition('submit', 'APPROVED', 'supplier').ok, false);
  assert.equal(checkTransition('submit', 'PENDING_REVIEW', 'supplier').ok, false);
  assert.equal(checkTransition('submit', 'ARCHIVED', 'supplier').ok, false);
});

test('submit lands in PENDING_REVIEW', () => {
  const result = checkTransition('submit', 'DRAFT', 'supplier');
  assert.deepEqual(result, { ok: true, to: 'PENDING_REVIEW' });
});

test('only admins approve, and only from PENDING_REVIEW', () => {
  assert.equal(checkTransition('approve', 'PENDING_REVIEW', 'admin').ok, true);
  assert.deepEqual(checkTransition('approve', 'PENDING_REVIEW', 'supplier'), {
    ok: false,
    reason: 'forbidden_actor'
  });
  assert.deepEqual(checkTransition('approve', 'DRAFT', 'admin'), {
    ok: false,
    reason: 'invalid_from'
  });
});

test('admin can reject a pending OR an already-live product', () => {
  assert.equal(checkTransition('reject', 'PENDING_REVIEW', 'admin').ok, true);
  assert.equal(checkTransition('reject', 'APPROVED', 'admin').ok, true);
  assert.equal(checkTransition('reject', 'DRAFT', 'admin').ok, false);
  assert.equal(checkTransition('reject', 'APPROVED', 'supplier').ok, false);
});

test('archive is allowed from every non-archived status, unarchive → DRAFT', () => {
  for (const from of ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const) {
    assert.equal(checkTransition('archive', from, 'supplier').ok, true, from);
  }
  assert.equal(checkTransition('archive', 'ARCHIVED', 'supplier').ok, false);
  assert.deepEqual(checkTransition('unarchive', 'ARCHIVED', 'supplier'), {
    ok: true,
    to: 'DRAFT'
  });
  assert.equal(checkTransition('unarchive', 'ARCHIVED', 'admin').ok, false);
});

test('availableActions matches the matrix', () => {
  assert.deepEqual(availableActions('DRAFT', 'supplier').sort(), ['archive', 'submit']);
  assert.deepEqual(availableActions('PENDING_REVIEW', 'admin').sort(), [
    'approve',
    'archive',
    'reject'
  ]);
  assert.deepEqual(availableActions('ARCHIVED', 'supplier'), ['unarchive']);
});
