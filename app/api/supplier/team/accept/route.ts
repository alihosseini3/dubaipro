import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createRoute } from '@/lib/api/handler';
import { acceptInviteSchema } from '@/lib/supplier/team-schemas';
import { acceptInvite, findPendingInvite, TeamError } from '@/lib/supplier/team-service';
import { createSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const tokenQuerySchema = z.object({ token: z.string().min(20).max(200) });

/**
 * Public invite endpoints. The emailed token is the credential (same trust
 * model as password reset: it proves control of the invited inbox).
 */

/** Validate a token for the accept page: who invited, does the email have an account. */
export const GET = createRoute(
  {
    auth: 'public',
    query: tokenQuerySchema,
    rateLimit: { key: 'team-accept-check', limit: 20, windowSeconds: 900 }
  },
  async ({ query }) => {
    const invite = await findPendingInvite(query.token);
    if (!invite) {
      return NextResponse.json(
        { error: 'Invitation is invalid or has expired' },
        { status: 404 }
      );
    }
    const account = await prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true }
    });
    return NextResponse.json({
      data: {
        supplierName: invite.supplier.name,
        email: invite.email,
        role: invite.role,
        requiresAccount: !account
      }
    });
  }
);

export const POST = createRoute(
  {
    auth: 'public',
    body: acceptInviteSchema,
    rateLimit: { key: 'team-accept', limit: 10, windowSeconds: 900 },
    audit: { action: 'supplier.member.join', entityType: 'SupplierMember' }
  },
  async ({ body, audit }) => {
    try {
      const result = await acceptInvite(body);

      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, name: true, email: true, role: true }
      });
      if (user) await createSession(user);

      audit.entityId = result.userId;
      audit.supplierId = result.supplierId;
      return NextResponse.json({
        data: { supplierId: result.supplierId, createdAccount: result.createdAccount }
      });
    } catch (error) {
      if (error instanceof TeamError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
