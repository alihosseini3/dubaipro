import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { RfqCreateWizard } from '@/components/rfq/RfqCreateWizard';

export const metadata: Metadata = { title: 'Edit RFQ | DubaiPro' };

/** Statuses a buyer is allowed to edit. */
const EDITABLE = ['DRAFT', 'PENDING_REVIEW', 'OPEN', 'QUOTED', 'NEGOTIATING'];

export default async function RfqEditPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?from=/${locale}/rfq/${slug}/edit`);

  const [rfq, categories, t] = await Promise.all([
    prisma.rfqRequest.findUnique({
      where: { slug },
      select: {
        userId: true,
        status: true,
        title: true,
        description: true,
        categoryId: true,
        productRef: true,
        quantity: true,
        unit: true,
        targetPrice: true,
        currency: true,
        shippingCountry: true,
        urgency: true,
        visibility: true,
        sourcingNotes: true,
        contactWhatsapp: true,
        contactEmail: true,
        attachments: {
          select: {
            id: true,
            url: true,
            name: true,
            mimeType: true,
            size: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    getTranslations({ locale, namespace: 'rfqMarketplace' }),
  ]);

  if (!rfq) notFound();

  const isAdmin = user.role === 'ADMIN';
  // Only the owner (or an admin) may edit.
  if (rfq.userId !== user.id && !isAdmin) redirect(`/${locale}/rfq/${slug}`);
  // Editing is only meaningful in pre-terminal states.
  if (!EDITABLE.includes(rfq.status)) redirect(`/${locale}/rfq/${slug}`);

  const labels = {
    step1: t('create.step1'), step2: t('create.step2'),
    step3: t('create.step3'), step4: t('create.step4'),
    eyebrow: t('create.eyebrow'), h1: t('create.h1'),
    h2: t('create.h2'), h3: t('create.h3'), h4: t('create.h4'),
    rfqTitle: t('create.rfqTitle'), description: t('create.description'),
    category: t('create.category'), productRef: t('create.productRef'),
    quantity: t('create.quantity'), unit: t('create.unit'),
    targetPrice: t('create.targetPrice'), currency: t('create.currency'),
    destination: t('create.destination'), urgency: t('create.urgency'),
    visibility: t('create.visibility'), sourcingNotes: t('create.sourcingNotes'),
    back: t('create.back'), continue: t('create.continue'),
    submit: t('edit.submit'), submitting: t('create.submitting'),
    placeholderTitle: t('create.placeholderTitle'),
    placeholderDescription: t('create.placeholderDescription'),
    placeholderCategory: t('create.placeholderCategory'),
    placeholderProductRef: t('create.placeholderProductRef'),
    placeholderQuantity: t('create.placeholderQuantity'),
    placeholderPrice: t('create.placeholderPrice'),
    placeholderSourcingNotes: t('create.placeholderSourcingNotes'),
    placeholderCountry: t('create.placeholderCountry'),
    visPublic: t('create.visPublic'), visInvited: t('create.visInvited'),
    visPrivate: t('create.visPrivate'), reviewNote: t('edit.reviewNote'),
    errTitle: t('create.errTitle'), errDescription: t('create.errDescription'),
    errQuantity: t('create.errQuantity'), errDestination: t('create.errDestination'),
    reviewLabelTitle: t('create.reviewLabelTitle'), reviewLabelQty: t('create.reviewLabelQty'),
    reviewLabelPrice: t('create.reviewLabelPrice'), reviewLabelDest: t('create.reviewLabelDest'),
    reviewLabelUrgency: t('create.reviewLabelUrgency'), reviewLabelVis: t('create.reviewLabelVis'),
    urgencyStandard: t('urgency.STANDARD'), urgencyUrgent: t('urgency.URGENT'),
    urgencyAsap: t('urgency.ASAP'),
    whatsapp: t('create.whatsapp'), email: t('create.email'),
    placeholderWhatsapp: t('create.placeholderWhatsapp'),
    placeholderEmail: t('create.placeholderEmail'),
    whatsappNote: t('create.whatsappNote'), emailNote: t('create.emailNote'),
    errWhatsapp: t('create.errWhatsapp'),
    reviewLabelWhatsapp: t('create.reviewLabelWhatsapp'),
    reviewLabelEmail: t('create.reviewLabelEmail'),
    contactHeading: t('create.contactHeading'),
    attachments: t('create.attachments'),
    attachmentsHint: t('create.attachmentsHint'),
  };

  const initial = {
    title: rfq.title,
    description: rfq.description,
    categoryId: rfq.categoryId ?? '',
    productRef: rfq.productRef ?? '',
    quantity: String(rfq.quantity),
    unit: rfq.unit,
    targetPrice: rfq.targetPrice != null ? String(Number(rfq.targetPrice)) : '',
    currency: rfq.currency,
    shippingCountry: rfq.shippingCountry,
    urgency: rfq.urgency,
    visibility: rfq.visibility,
    sourcingNotes: rfq.sourcingNotes ?? '',
    whatsapp: rfq.contactWhatsapp ?? '+',
    email: rfq.contactEmail ?? '',
  };

  return (
    <div className="-mx-4 -my-10 md:-mx-6 lg:-mx-8">
      <div className="border-b border-slate-200/60 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-10 text-white md:px-6 md:py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-orange-300 ring-1 ring-orange-400/30">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            {t('edit.eyebrow')}
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">{t('edit.title')}</h1>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">{t('edit.subtitle')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 lg:px-8">
        <RfqCreateWizard
          locale={locale}
          categories={categories}
          labels={labels}
          mode="edit"
          slug={slug}
          initial={initial}
          initialAttachments={rfq.attachments}
        />
      </div>
    </div>
  );
}
