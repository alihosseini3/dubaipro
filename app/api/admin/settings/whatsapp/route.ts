import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import {
  getWhatsAppSettings,
  updateWhatsAppSettings
} from '@/lib/whatsapp/service';

export const runtime = 'nodejs';

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const data = await getWhatsAppSettings();
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/settings/whatsapp');
  }
}

type Body = {
  phone?: unknown;
  defaultMessage?: unknown;
  isEnabled?: unknown;
  showFloating?: unknown;
  showOnProduct?: unknown;
  enableInternalChat?: unknown;
  enableContactForm?: unknown;
};

export async function PUT(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const {
    phone,
    defaultMessage,
    isEnabled,
    showFloating,
    showOnProduct,
    enableInternalChat,
    enableContactForm
  } = parsed.data;

  try {
    const data = await updateWhatsAppSettings({
      phone: typeof phone === 'string' ? phone : undefined,
      defaultMessage:
        typeof defaultMessage === 'string' ? defaultMessage : undefined,
      isEnabled: typeof isEnabled === 'boolean' ? isEnabled : undefined,
      showFloating: typeof showFloating === 'boolean' ? showFloating : undefined,
      showOnProduct:
        typeof showOnProduct === 'boolean' ? showOnProduct : undefined,
      enableInternalChat:
        typeof enableInternalChat === 'boolean' ? enableInternalChat : undefined,
      enableContactForm:
        typeof enableContactForm === 'boolean' ? enableContactForm : undefined
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handlePrismaError(error, 'PUT /api/admin/settings/whatsapp');
  }
}
