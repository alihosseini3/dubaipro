import test from 'node:test';
import assert from 'node:assert/strict';

import { canTransitionRfq, canTransitionQuote } from '../status-machine.ts';

test('RFQ: valid transitions are allowed', () => {
  assert.equal(canTransitionRfq('DRAFT', 'PENDING_REVIEW'), true);
  assert.equal(canTransitionRfq('DRAFT', 'OPEN'), true);
  assert.equal(canTransitionRfq('PENDING_REVIEW', 'OPEN'), true);
  assert.equal(canTransitionRfq('OPEN', 'QUOTED'), true);
  assert.equal(canTransitionRfq('QUOTED', 'ACCEPTED'), true);
  assert.equal(canTransitionRfq('ACCEPTED', 'FULFILLED'), true);
  assert.equal(canTransitionRfq('FULFILLED', 'CLOSED'), true);
  assert.equal(canTransitionRfq('EXPIRED', 'OPEN'), true);
});

test('RFQ: invalid transitions are rejected', () => {
  assert.equal(canTransitionRfq('DRAFT', 'ACCEPTED'), false);
  assert.equal(canTransitionRfq('OPEN', 'FULFILLED'), false);
  assert.equal(canTransitionRfq('PENDING_REVIEW', 'QUOTED'), false);
});

test('RFQ: terminal states have no exits', () => {
  assert.equal(canTransitionRfq('CLOSED', 'OPEN'), false);
  assert.equal(canTransitionRfq('CLOSED', 'DRAFT'), false);
});

test('Quote: valid + invalid transitions', () => {
  assert.equal(canTransitionQuote('DRAFT', 'SUBMITTED'), true);
  assert.equal(canTransitionQuote('SUBMITTED', 'ACCEPTED'), true);
  assert.equal(canTransitionQuote('SUBMITTED', 'WITHDRAWN'), true);
  // Terminal quote states
  assert.equal(canTransitionQuote('ACCEPTED', 'WITHDRAWN'), false);
  assert.equal(canTransitionQuote('REJECTED', 'SUBMITTED'), false);
  assert.equal(canTransitionQuote('WITHDRAWN', 'SUBMITTED'), false);
});
