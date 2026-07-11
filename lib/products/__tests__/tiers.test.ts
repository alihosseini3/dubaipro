import test from 'node:test';
import assert from 'node:assert/strict';

import { validateTierSet } from '../tiers.ts';

test('validateTierSet rejects overlaps and duplicate boundaries', () => {
  const base = { currency: 'USD', unitPrice: 5, leadTimeDays: null };
  assert.equal(
    validateTierSet([
      { ...base, minQty: 1, maxQty: 100 },
      { ...base, minQty: 50, maxQty: 200 } // overlap
    ]).ok,
    false
  );
  assert.equal(
    validateTierSet([
      { ...base, minQty: 10, maxQty: 20 },
      { ...base, minQty: 10, maxQty: 30 } // duplicate minQty
    ]).ok,
    false
  );
});

test('open-ended tier must be last within its currency', () => {
  const base = { currency: 'USD', unitPrice: 5, leadTimeDays: null };
  assert.equal(
    validateTierSet([
      { ...base, minQty: 1, maxQty: null },
      { ...base, minQty: 100, maxQty: 200 }
    ]).ok,
    false
  );
  assert.equal(
    validateTierSet([
      { ...base, minQty: 1, maxQty: 99 },
      { ...base, minQty: 100, maxQty: null }
    ]).ok,
    true
  );
});

test('maxQty below minQty is rejected', () => {
  assert.equal(
    validateTierSet([
      { currency: 'USD', minQty: 10, maxQty: 5, unitPrice: 2, leadTimeDays: null }
    ]).ok,
    false
  );
});

test('currencies are validated independently', () => {
  assert.equal(
    validateTierSet([
      { currency: 'USD', minQty: 1, maxQty: null, unitPrice: 5, leadTimeDays: null },
      { currency: 'AED', minQty: 1, maxQty: null, unitPrice: 18, leadTimeDays: null }
    ]).ok,
    true
  );
});
