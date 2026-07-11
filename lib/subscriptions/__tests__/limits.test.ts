import test from 'node:test';
import assert from 'node:assert/strict';

import { isWithinLimit, resolvePeriodEnd } from '../pure.ts';

test('isWithinLimit boundary behaviour: blocks AT the cap, allows below', () => {
  assert.equal(isWithinLimit(0, 10), true);
  assert.equal(isWithinLimit(9, 10), true);
  assert.equal(isWithinLimit(10, 10), false); // at cap → the NEXT create is blocked
  assert.equal(isWithinLimit(15, 10), false); // grandfathered over-cap → still blocked
});

test('null limit means unlimited', () => {
  assert.equal(isWithinLimit(0, null), true);
  assert.equal(isWithinLimit(1_000_000, null), true);
});

test('resolvePeriodEnd adds calendar months', () => {
  const from = new Date('2026-01-15T00:00:00Z');
  assert.equal(
    resolvePeriodEnd(12, from).toISOString().slice(0, 10),
    '2027-01-15'
  );
  assert.equal(resolvePeriodEnd(1, from).toISOString().slice(0, 10), '2026-02-15');
});
