import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import {
  findOrCreateDirectConversation,
  MessagingError
} from '@/lib/messaging/service';

export const runtime = 'nodejs';

const bodySchema = z.object({ peerId: z.string().min(1) });

/**
 * LEGACY-compatible entry point ("chat with seller" buttons pass the seller
 * USER id). Resolves the peer's supplier org and opens the DIRECT thread.
 * New code should POST /api/conversations with a supplierId directly.
 */
export const POST = createRoute(
  { auth: 'user', body: bodySchema },
  async ({ user, body }) => {
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { userId: body.peerId },
        select: { id: true }
      });
      if (!supplier) {
        return NextResponse.json({ error: 'Peer not found' }, { status: 404 });
      }
      const conversation = await findOrCreateDirectConversation({
        buyerId: user.id,
        supplierId: supplier.id
      });
      return NextResponse.json({ data: { id: conversation.id } });
    } catch (error) {
      if (error instanceof MessagingError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
