import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTIFICATION_TEMPLATES,
  getTemplate,
  templateToMessageKey
} from '../registry.ts';

test('every template declares inApp as a channel', () => {
  for (const [key, def] of Object.entries(NOTIFICATION_TEMPLATES)) {
    assert.ok(def.channels.includes('inApp'), `${key} must include inApp`);
  }
});

test('templates with an email channel provide an email renderer', () => {
  for (const [key, def] of Object.entries(NOTIFICATION_TEMPLATES)) {
    if (def.channels.includes('email')) {
      assert.equal(typeof def.email, 'function', `${key} needs an email renderer`);
    }
  }
});

test('message.new is in-app only (debounced ping, no email spam)', () => {
  assert.deepEqual(getTemplate('message.new').channels, ['inApp']);
});

test('email renderers interpolate params', () => {
  const rendered = getTemplate('product.rejected').email!({
    productTitle: 'Steel Pipe',
    reason: 'Missing images'
  });
  assert.match(rendered.subject, /Steel Pipe/);
  assert.match(rendered.text, /Missing images/);
});

test('templateToMessageKey maps dots to underscores', () => {
  assert.equal(templateToMessageKey('product.approved'), 'product_approved');
  assert.equal(templateToMessageKey('team.member.joined'), 'team_member_joined');
});
