import { NextResponse } from 'next/server';
import type { SupplierMemberRole } from '@prisma/client';

import { createRoute } from '@/lib/api/handler';
import { updateMemberSchema } from '@/lib/supplier/team-schemas';
import { removeMember, TeamError, updateMember } from '@/lib/supplier/team-service';

export const runtime = 'nodejs';

export const PATCH = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.team.manage',
    body: updateMemberSchema,
    audit: { action: 'supplier.member.update', entityType: 'SupplierMember' }
  },
  async ({ supplier, params, body, audit }) => {
    try {
      const member = await updateMember(supplier.id, String(params.id), {
        role: body.role as SupplierMemberRole | undefined,
        isActive: body.isActive
      });
      audit.entityId = member.id;
      audit.diff = { after: { role: member.role, isActive: member.isActive } };
      return NextResponse.json({ data: member });
    } catch (error) {
      if (error instanceof TeamError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);

export const DELETE = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.team.manage',
    audit: { action: 'supplier.member.remove', entityType: 'SupplierMember' }
  },
  async ({ supplier, params, audit }) => {
    try {
      const id = String(params.id);
      await removeMember(supplier.id, id);
      audit.entityId = id;
      return NextResponse.json({ data: { id } });
    } catch (error) {
      if (error instanceof TeamError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
);
