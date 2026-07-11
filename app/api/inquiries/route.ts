import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { inquirySchema } from '@/lib/messaging/schemas';
import { createInquiry, MessagingError } from '@/lib/messaging/service';

export const runtime = 'nodejs';

/**
 * POST /api/inquiries — product inquiry from the PDP. Lands in the
 * supplier's unified inbox as an INQUIRY conversation (one thread per
 * buyer+product; repeats append).
 */
export const POST = createRoute(
  {
    auth: 'user',
    body: inquirySchema,
    rateLimit: { key: 'inquiry-create', limit: 10, windowSeconds: 3600 },
    audit: { action: 'inquiry.create', entityType: 'Conversation' }
  },
  async ({ user, body, audit }) => {
    try {
      const result = await createInquiry(user.id, body);
      audit.entityId = result.id;
      return NextResponse.json(
        { data: result },
        { status: result.created ? 201 : 200 }
      );
    } catch (error) {
      if (error instanceof MessagingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
