import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  NOTIFICATION_TEMPLATES,
  getTemplate,
  templateToMessageKey
} from '../registry.ts';

const LOCALES = ['en', 'fa', 'ar', 'ur'] as const;

function loadMessages(locale: string): Record<string, unknown> {
  const raw = readFileSync(
    path.join(process.cwd(), 'messages', `${locale}.json`),
    'utf8'
  );
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

test('every template declares inApp as a channel', () => {
  for (const [key, def] of Object.entries(NOTIFICATION_TEMPLATES)) {
    assert.ok(def.channels.includes('inApp'), `${key} must include inApp`);
  }
});

test('email channel ⇔ email flag consistency', () => {
  for (const [key, def] of Object.entries(NOTIFICATION_TEMPLATES)) {
    if (def.channels.includes('email')) {
      assert.equal(def.email, true, `${key} has email channel but no email flag`);
    }
  }
});

test('message.new is in-app only (debounced ping, no email spam)', () => {
  assert.deepEqual(getTemplate('message.new').channels, ['inApp']);
});

test('every email template has subject+body copy in ALL four locales', () => {
  for (const locale of LOCALES) {
    const messages = loadMessages(locale);
    const emails = (messages.notifications as Record<string, unknown> | undefined)
      ?.emails as Record<string, string> | undefined;
    assert.ok(emails, `${locale}: notifications.emails namespace missing`);
    for (const [key, def] of Object.entries(NOTIFICATION_TEMPLATES)) {
      if (!def.email) continue;
      const base = templateToMessageKey(key);
      assert.ok(
        typeof emails[`${base}_subject`] === 'string' &&
          emails[`${base}_subject`].length > 0,
        `${locale}: missing ${base}_subject`
      );
      assert.ok(
        typeof emails[`${base}_body`] === 'string' && emails[`${base}_body`].length > 0,
        `${locale}: missing ${base}_body`
      );
    }
  }
});

test('every in-app template has copy in ALL four locales (items.*)', () => {
  for (const locale of LOCALES) {
    const messages = loadMessages(locale);
    const items = (messages.notifications as Record<string, unknown> | undefined)
      ?.items as Record<string, string> | undefined;
    assert.ok(items, `${locale}: notifications.items namespace missing`);
    for (const key of Object.keys(NOTIFICATION_TEMPLATES)) {
      const base = templateToMessageKey(key);
      assert.ok(
        typeof items[base] === 'string' && items[base].length > 0,
        `${locale}: missing items.${base}`
      );
    }
  }
});

test('templateToMessageKey maps dots to underscores', () => {
  assert.equal(templateToMessageKey('product.approved'), 'product_approved');
  assert.equal(templateToMessageKey('team.member.joined'), 'team_member_joined');
});
