'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { acceptQuote, rejectQuote, withdrawQuote } from '@/lib/rfq/quotes';
import { sendRfqMessage } from '@/lib/rfq/messages';
import { canAccessRfqThread } from '@/lib/rfq/access';

/** Max characters allowed in a single negotiation message. */
const MAX_MESSAGE_LENGTH = 5000;

export async function acceptQuoteAction(
  quoteId: string,
  locale: string,
  slug: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const result = await acceptQuote(quoteId, user.id);
  if (result.ok) revalidatePath(`/${locale}/rfq/${slug}`);
  return result;
}

export async function rejectQuoteAction(
  quoteId: string,
  locale: string,
  slug: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const result = await rejectQuote(quoteId, user.id);
  if (result.ok) revalidatePath(`/${locale}/rfq/${slug}`);
  return result;
}

export async function withdrawQuoteAction(
  quoteId: string,
  locale: string,
  slug: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const supplier = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!supplier) return { ok: false, error: 'not_a_supplier' };

  const result = await withdrawQuote(quoteId, supplier.id);
  if (result.ok) revalidatePath(`/${locale}/rfq/${slug}`);
  return result;
}

export async function sendMessageAction(
  rfqId: string,
  content: string,
  options?: { quoteId?: string }
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const trimmed = content?.trim() ?? '';
  if (!trimmed) return { ok: false, error: 'empty_content' };
  if (trimmed.length > MAX_MESSAGE_LENGTH) return { ok: false, error: 'content_too_long' };

  // Authorization: only the buyer, an admin, or a supplier with a quote
  // on this RFQ may post into its negotiation threads.
  const allowed = await canAccessRfqThread(rfqId, user.id, user.role === 'ADMIN');
  if (!allowed) return { ok: false, error: 'forbidden' };

  try {
    await sendRfqMessage(rfqId, user.id, trimmed, options);
    return { ok: true };
  } catch {
    return { ok: false, error: 'send_failed' };
  }
}
