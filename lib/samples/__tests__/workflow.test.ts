import test from 'node:test';
import assert from 'node:assert/strict';

import { checkSampleTransition } from '../workflow.ts';

test('happy path: pending → accepted → shipped → closed', () => {
  assert.equal(checkSampleTransition('accept', 'PENDING'), 'ACCEPTED');
  assert.equal(checkSampleTransition('ship', 'ACCEPTED'), 'SHIPPED');
  assert.equal(checkSampleTransition('close', 'SHIPPED'), 'CLOSED');
});

test('decline only from pending', () => {
  assert.equal(checkSampleTransition('decline', 'PENDING'), 'DECLINED');
  assert.equal(checkSampleTransition('decline', 'ACCEPTED'), null);
  assert.equal(checkSampleTransition('decline', 'SHIPPED'), null);
});

test('ship requires acceptance first', () => {
  assert.equal(checkSampleTransition('ship', 'PENDING'), null);
  assert.equal(checkSampleTransition('ship', 'SHIPPED'), null);
});

test('terminal states accept no further actions', () => {
  for (const action of ['accept', 'decline', 'ship', 'close'] as const) {
    assert.equal(checkSampleTransition(action, 'DECLINED'), null, `decline+${action}`);
    assert.equal(checkSampleTransition(action, 'CLOSED'), null, `closed+${action}`);
  }
});

test('close is allowed from every non-terminal state', () => {
  assert.equal(checkSampleTransition('close', 'PENDING'), 'CLOSED');
  assert.equal(checkSampleTransition('close', 'ACCEPTED'), 'CLOSED');
});
