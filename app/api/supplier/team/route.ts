import { NextResponse } from 'next/server';

import { createRoute } from '@/lib/api/handler';
import { listTeam } from '@/lib/supplier/team-service';

export const runtime = 'nodejs';

export const GET = createRoute(
  { auth: 'supplier', permission: 'supplier.team.manage' },
  async ({ supplier }) => {
    const team = await listTeam(supplier.id);
    return NextResponse.json({ data: team });
  }
);
