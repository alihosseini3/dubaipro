import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import {
  getHeaderSettings,
  updateHeaderSettings,
  type HeaderSettingsDTO
} from '@/lib/header/service';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const data = await getHeaderSettings();
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/header/settings');
  }
}

export async function PUT(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<Partial<HeaderSettingsDTO>>(request);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const data = await updateHeaderSettings(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'PUT /api/admin/header/settings');
  }
}
