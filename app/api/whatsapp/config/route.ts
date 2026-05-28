import { NextResponse } from 'next/server';

import { handlePrismaError } from '@/lib/api/errors';
import { getWhatsAppSettings } from '@/lib/whatsapp/service';

export const runtime = 'nodejs';

/**
 * Public read-only config endpoint used by the floating WhatsApp button.
 * Returns only the fields required by the client.
 */
export async function GET() {
  try {
    const s = await getWhatsAppSettings();
    return NextResponse.json({
      data: {
        phone: s.phone,
        defaultMessage: s.defaultMessage,
        isEnabled: s.isEnabled,
        showFloating: s.showFloating,
        showOnProduct: s.showOnProduct
      }
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/whatsapp/config');
  }
}
