import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth/session';
import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/validation';
import { createContactMessage } from '@/lib/contact/service';
import { getWhatsAppSettings } from '@/lib/whatsapp/service';

export const runtime = 'nodejs';

type Body = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  locale?: unknown;
};

/**
 * Public contact form endpoint used by the Chat Hub for guest visitors.
 * - Honors the `enableContactForm` admin toggle (returns 403 when off).
 * - Validates and sanitizes input server-side; never trusts the client.
 * - Associates the submission with the current user when one is signed in.
 */
export async function POST(request: Request) {
  // Respect admin kill-switch: if the form is disabled, refuse submissions
  // even though the API path stays publicly reachable.
  try {
    const settings = await getWhatsAppSettings();
    if (!settings.enableContactForm) {
      return NextResponse.json({ error: 'disabled' }, { status: 403 });
    }
  } catch {
    // If settings cannot be read we fail closed — better to block than to
    // accept submissions silently.
    return NextResponse.json({ error: 'disabled' }, { status: 503 });
  }

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const { name, email, subject, message, locale } = parsed.data;

  if (typeof name !== 'string' || typeof email !== 'string' ||
      typeof message !== 'string') {
    return badRequest('Invalid payload');
  }

  const user = await getCurrentUser().catch(() => null);
  const userAgent = request.headers.get('user-agent') ?? '';

  try {
    // Pre-save trace: keep PII out of logs (only meta).
    console.log('[contact] saving', {
      hasName: typeof name === 'string',
      hasEmail: typeof email === 'string',
      hasSubject: typeof subject === 'string',
      messageLength: typeof message === 'string' ? message.length : 0,
      userId: user?.id ?? null,
      locale: typeof locale === 'string' ? locale : null
    });

    const result = await createContactMessage({
      name,
      email,
      subject: typeof subject === 'string' ? subject : null,
      message,
      locale: typeof locale === 'string' ? locale : null,
      userId: user?.id ?? null,
      userAgent
    });

    if (!result.ok) {
      console.warn('[contact] validation failed', { errors: result.errors });
      return NextResponse.json(
        { error: 'validation', details: result.errors },
        { status: 422 }
      );
    }

    console.log('[contact] saved', { id: result.data.id });
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    // Surface the actual error so we never silently swallow failures.
    console.error('[contact] save failed', error);
    return handlePrismaError(error, 'POST /api/contact');
  }
}
