'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { acceptQuote, rejectQuote, withdrawQuote } from '@/lib/rfq/quotes';
import { sendRfqMessage } from '@/lib/rfq/messages';

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

  try {
    await sendRfqMessage(rfqId, user.id, content, options);
    return { ok: true };
  } catch {
    return { ok: false, error: 'send_failed' };
  }
}
