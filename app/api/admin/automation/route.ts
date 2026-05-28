import { NextResponse } from 'next/server';
import { AutomationChannel, AutomationEventType } from '@prisma/client';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { listAllSeedKeys, getDefaultTemplate } from '@/lib/automation/templates';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Admin: list all (event, channel, locale) combinations including
 * unsaved seeds. Each row shows whether it's persisted (overridable)
 * or still using built-in defaults.
 */
export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const [rows, seeds] = await Promise.all([
      prisma.automationRule.findMany({
        orderBy: [{ eventType: 'asc' }, { channel: 'asc' }, { locale: 'asc' }]
      }),
      Promise.resolve(listAllSeedKeys())
    ]);

    const byKey = new Map(
      rows.map((r) => [`${r.eventType}:${r.channel}:${r.locale}`, r])
    );

    const data = seeds.map((s) => {
      const key = `${s.eventType}:${s.channel}:${s.locale}`;
      const row = byKey.get(key);
      const seed = getDefaultTemplate(s.eventType, s.channel, s.locale);
      return {
        eventType: s.eventType,
        channel: s.channel,
        locale: s.locale,
        enabled: row?.enabled ?? true,
        subject: row?.subject ?? seed?.subject ?? null,
        body: row?.body ?? seed?.body ?? '',
        isOverride: Boolean(row),
        id: row?.id ?? null,
        updatedAt: row?.updatedAt ?? null
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/automation');
  }
}

type UpsertBody = {
  eventType?: unknown;
  channel?: unknown;
  locale?: unknown;
  enabled?: unknown;
  subject?: unknown;
  body?: unknown;
};

const VALID_EVENTS = new Set(Object.values(AutomationEventType));
const VALID_CHANNELS = new Set(Object.values(AutomationChannel));

/**
 * Upsert by composite key (eventType, channel, locale). Used for both
 * "enable/disable" toggles and template edits.
 */
export async function PUT(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<UpsertBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (typeof body.eventType !== 'string' || !VALID_EVENTS.has(body.eventType as AutomationEventType)) {
    return badRequest('invalid eventType');
  }
  if (typeof body.channel !== 'string' || !VALID_CHANNELS.has(body.channel as AutomationChannel)) {
    return badRequest('invalid channel');
  }
  if (typeof body.locale !== 'string' || body.locale.length === 0 || body.locale.length > 8) {
    return badRequest('invalid locale');
  }
  if (typeof body.body !== 'string' || body.body.length === 0 || body.body.length > 10_000) {
    return badRequest('body must be 1..10000 chars');
  }

  const subject =
    body.subject === null || body.subject === undefined
      ? null
      : typeof body.subject === 'string' && body.subject.length <= 200
        ? body.subject
        : undefined;
  if (subject === undefined) return badRequest('invalid subject');

  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;

  try {
    // Admin UI only manages the ALL fallback rules. Per-segment
    // overrides ship as code seeds today; a future iteration will let
    // admins author them directly through this endpoint.
    const row = await prisma.automationRule.upsert({
      where: {
        eventType_channel_locale_segment: {
          eventType: body.eventType as AutomationEventType,
          channel: body.channel as AutomationChannel,
          locale: body.locale,
          segment: 'ALL'
        }
      },
      create: {
        eventType: body.eventType as AutomationEventType,
        channel: body.channel as AutomationChannel,
        locale: body.locale,
        segment: 'ALL',
        enabled,
        subject,
        body: body.body
      },
      update: { enabled, subject, body: body.body }
    });
    return NextResponse.json({ data: row });
  } catch (error) {
    return handlePrismaError(error, 'PUT /api/admin/automation');
  }
}
