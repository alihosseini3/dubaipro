import { prisma } from '@/lib/prisma';

export type ContactInput = {
  name: string;
  email: string;
  subject?: string | null;
  message: string;
  userId?: string | null;
  locale?: string | null;
  userAgent?: string | null;
};

export type ContactValidationError = {
  field: 'name' | 'email' | 'subject' | 'message';
  code: 'required' | 'too_short' | 'too_long' | 'invalid';
};

const NAME_MIN = 2;
const NAME_MAX = 120;
const SUBJECT_MAX = 200;
const MESSAGE_MIN = 5;
const MESSAGE_MAX = 4000;
const EMAIL_MAX = 254;

// RFC 5322-lite — sufficient for UI validation; auth/email systems do
// authoritative checks.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(input: unknown, max: number): string {
  if (typeof input !== 'string') return '';
  // Strip control chars and collapse whitespace; trim and clamp length.
  return input
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Validate raw user input from the public Chat Hub contact form.
 * Returns the sanitized payload or a list of structured errors.
 */
export function validateContactInput(
  raw: ContactInput
): { ok: true; data: Required<Omit<ContactInput, 'userId' | 'userAgent' | 'locale' | 'subject'>> & {
      subject: string | null;
      userId: string | null;
      locale: string | null;
      userAgent: string | null;
    } }
  | { ok: false; errors: ContactValidationError[] } {
  const errors: ContactValidationError[] = [];

  const name = clean(raw.name, NAME_MAX);
  const email = clean(raw.email, EMAIL_MAX).toLowerCase();
  const subject = raw.subject ? clean(raw.subject, SUBJECT_MAX) : '';
  const message = clean(raw.message, MESSAGE_MAX);

  if (!name) errors.push({ field: 'name', code: 'required' });
  else if (name.length < NAME_MIN)
    errors.push({ field: 'name', code: 'too_short' });

  if (!email) errors.push({ field: 'email', code: 'required' });
  else if (!EMAIL_RE.test(email))
    errors.push({ field: 'email', code: 'invalid' });

  if (!message) errors.push({ field: 'message', code: 'required' });
  else if (message.length < MESSAGE_MIN)
    errors.push({ field: 'message', code: 'too_short' });

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      email,
      subject: subject || null,
      message,
      userId: typeof raw.userId === 'string' && raw.userId ? raw.userId : null,
      locale:
        typeof raw.locale === 'string' && raw.locale.length <= 8
          ? raw.locale
          : null,
      userAgent:
        typeof raw.userAgent === 'string'
          ? raw.userAgent.slice(0, 500)
          : null
    }
  };
}

export async function createContactMessage(input: ContactInput) {
  const result = validateContactInput(input);
  if (!result.ok) return result;
  const row = await prisma.contactMessage.create({ data: result.data });
  return { ok: true as const, data: { id: row.id } };
}
