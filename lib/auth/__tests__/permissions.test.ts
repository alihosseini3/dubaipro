import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isAdminRole,
  memberHasPermission,
  roleHasPermission
} from '../permissions.ts';

test('SUPER_ADMIN has exclusive permissions ADMIN lacks', () => {
  assert.equal(roleHasPermission('SUPER_ADMIN', 'plans.manage'), true);
  assert.equal(roleHasPermission('SUPER_ADMIN', 'conversations.oversee'), true);
  assert.equal(roleHasPermission('ADMIN', 'plans.manage'), false);
  assert.equal(roleHasPermission('ADMIN', 'conversations.oversee'), false);
});

test('ADMIN keeps day-to-day platform permissions', () => {
  assert.equal(roleHasPermission('ADMIN', 'products.review'), true);
  assert.equal(roleHasPermission('ADMIN', 'suppliers.manage'), true);
  assert.equal(roleHasPermission('ADMIN', 'audit.read'), true);
});

test('buyer roles (CUSTOMER, legacy SELLER) have no platform permissions', () => {
  assert.equal(roleHasPermission('CUSTOMER', 'products.review'), false);
  assert.equal(roleHasPermission('SELLER', 'products.review'), false);
  assert.equal(roleHasPermission('SELLER', 'suppliers.manage'), false);
});

test('SUPPLIER role alone grants nothing — capabilities come from membership', () => {
  assert.equal(roleHasPermission('SUPPLIER', 'supplier.products.write'), false);
});

test('null/undefined subjects are always denied', () => {
  assert.equal(roleHasPermission(null, 'audit.read'), false);
  assert.equal(roleHasPermission(undefined, 'audit.read'), false);
  assert.equal(isAdminRole(null), false);
});

test('member matrix: OWNER and MANAGER manage the team, others do not', () => {
  assert.equal(memberHasPermission('OWNER', 'supplier.team.manage'), true);
  assert.equal(memberHasPermission('MANAGER', 'supplier.team.manage'), true);
  assert.equal(memberHasPermission('PRODUCT_EDITOR', 'supplier.team.manage'), false);
  assert.equal(memberHasPermission('MESSAGING_AGENT', 'supplier.team.manage'), false);
  assert.equal(memberHasPermission('ANALYST', 'supplier.team.manage'), false);
});

test('member matrix: role scoping matches responsibilities', () => {
  assert.equal(memberHasPermission('PRODUCT_EDITOR', 'supplier.products.write'), true);
  assert.equal(memberHasPermission('PRODUCT_EDITOR', 'supplier.messages'), false);
  assert.equal(memberHasPermission('MESSAGING_AGENT', 'supplier.messages'), true);
  assert.equal(memberHasPermission('MESSAGING_AGENT', 'supplier.products.write'), false);
  assert.equal(memberHasPermission('ANALYST', 'supplier.analytics.read'), true);
  assert.equal(memberHasPermission('ANALYST', 'supplier.products.write'), false);
});

test('per-member overrides extend the role set', () => {
  assert.equal(
    memberHasPermission('ANALYST', 'supplier.products.write', [
      'supplier.products.write'
    ]),
    true
  );
  assert.equal(memberHasPermission('ANALYST', 'supplier.products.write', []), false);
});

test('isAdminRole covers both admin tiers only', () => {
  assert.equal(isAdminRole('ADMIN'), true);
  assert.equal(isAdminRole('SUPER_ADMIN'), true);
  assert.equal(isAdminRole('SUPPLIER'), false);
  assert.equal(isAdminRole('CUSTOMER'), false);
});
