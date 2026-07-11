import { NextResponse } from 'next/server';
import type { SupplierMemberRole } from '@prisma/client';

import { createRoute } from '@/lib/api/handler';
import { inviteMemberSchema } from '@/lib/supplier/team-schemas';
import { inviteMember, TeamError } from '@/lib/supplier/team-service';
import { PlanLimitError } from '@/lib/subscriptions/limits';

export const runtime = 'nodejs';

export const POST = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.team.manage',
    body: inviteMemberSchema,
    rateLimit: { key: 'team-invite', limit: 10, windowSeconds: 3600 },
    audit: { action: 'supplier.member.invite', entityType: 'SupplierInvite' }
  },
  async ({ supplier, user, body, audit }) => {
    try {
      const invite = await inviteMember({
        supplierId: supplier.id,
        supplierName: supplier.name,
        invitedById: user.id,
        email: body.email,
        role: body.role as SupplierMemberRole,
        locale: body.locale
      });
      audit.entityId = invite.id;
      audit.diff = { after: { email: invite.email, role: invite.role } };
      return NextResponse.json({ data: invite }, { status: 201 });
    } catch (error) {
      if (error instanceof PlanLimitError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof TeamError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
