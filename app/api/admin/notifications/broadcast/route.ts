import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { broadcastAnnouncement } from '@/lib/notifications/service';

export const runtime = 'nodejs';

const bodySchema = z.object({
  audience: z.enum(['ALL', 'BUYERS', 'SUPPLIERS']),
  message: z.string().trim().min(3).max(500),
  link: z.string().trim().max(2048).optional()
});

/**
 * POST /api/admin/notifications/broadcast — in-app announcement to an
 * audience segment. Mass email stays in the marketing Campaign engine.
 */
export const POST = createRoute(
  {
    auth: 'admin',
    permission: 'notifications.broadcast',
    body: bodySchema,
    rateLimit: { key: 'broadcast', limit: 5, windowSeconds: 3600 },
    audit: { action: 'notification.broadcast', entityType: 'Notification' }
  },
  async ({ body, audit }) => {
    const recipients = await broadcastAnnouncement(body);
    audit.diff = { after: { audience: body.audience, recipients } };
    return NextResponse.json({ data: { recipients } }, { status: 201 });
  }
);
