import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { revokeInvite, TeamError } from '@/lib/supplier/team-service';

export const runtime = 'nodejs';

export const DELETE = createRoute(
  {
    auth: 'supplier',
    permission: 'supplier.team.manage',
    audit: { action: 'supplier.invite.revoke', entityType: 'SupplierInvite' }
  },
  async ({ supplier, params, audit }) => {
    try {
      const id = String(params.id);
      await revokeInvite(supplier.id, id);
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
