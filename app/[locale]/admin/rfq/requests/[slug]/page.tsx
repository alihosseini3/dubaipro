import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requireAdmin } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';
import { AdminCard } from '@/components/admin/AdminCard';
import { RfqStatusBadge, RfqUrgencyBadge } from '@/components/rfq/RfqStatusBadge';
import { RfqModerationActions } from '@/components/admin/RfqModerationActions';

export const metadata: Metadata = { title: 'RFQ Request Detail | Admin' };

export default async function AdminRfqRequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  await requireAdmin(locale);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfq = await prisma.rfqRequest.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, name: true, email: true } },
      category: { select: { id: true, name: true } },
      // Note: regenerate Prisma client to include attachments relation
      // attachments: { select: { id: true, name: true, url: true, mimeType: true, size: true } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quotes: {
        include: {
          supplier: {
            select: { id: true, name: true, user: { select: { email: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invites: {
        include: {
          supplier: { select: { id: true, name: true, user: { select: { email: true } } } },
        },
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: {
        include: { sender: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _count: { select: { quotes: true, invites: true, messages: true } } as any,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  if (!rfq) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invitedSupplierIds = new Set(rfq.invites.map((i: any) => i.supplierId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/admin/rfq/requests`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-300 dark:border-slate-600 dark:bg-slate-800"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">{rfq.title}</h1>
            <p className="text-xs text-slate-500">Slug: {rfq.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RfqStatusBadge status={rfq.status} />
          <RfqUrgencyBadge urgency={rfq.urgency} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Buyer & Contact */}
          <AdminCard title="Buyer Information">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Name</div>
                <div className="font-medium text-slate-900 dark:text-white">{rfq.user.name}</div>
                <div className="text-xs text-slate-500">{rfq.user.email}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Contact</div>
                {rfq.contactWhatsapp && <div className="text-slate-700">WhatsApp: {rfq.contactWhatsapp}</div>}
                {rfq.contactEmail && <div className="text-slate-700">Email: {rfq.contactEmail}</div>}
                {!rfq.contactWhatsapp && !rfq.contactEmail && <div className="text-slate-400">—</div>}
              </div>
            </div>
          </AdminCard>

          {/* RFQ Details */}
          <AdminCard title="Request Details">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Quantity</div>
                <div className="font-semibold text-slate-900 dark:text-white">{rfq.quantity} {rfq.unit}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Target Price</div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {rfq.targetPrice ? `${rfq.targetPrice} ${rfq.currency}` : 'Not specified'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Destination</div>
                <div className="font-semibold text-slate-900 dark:text-white">{rfq.shippingCountry}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Category</div>
                <div className="font-semibold text-slate-900 dark:text-white">{rfq.category?.name ?? '—'}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Visibility</div>
                <div className="font-semibold text-slate-900 dark:text-white">{rfq.visibility}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Expires</div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {rfq.expiresAt ? new Date(rfq.expiresAt).toLocaleDateString() : 'No expiry'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Quotes</div>
                <div className="font-semibold text-orange-600">{rfq._count.quotes}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-slate-400">Views</div>
                <div className="font-semibold text-slate-900 dark:text-white">{rfq.viewCount}</div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
              <div className="text-[11px] font-bold uppercase text-slate-400">Description</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{rfq.description}</p>
            </div>

            {rfq.sourcingNotes && (
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                <div className="text-[11px] font-bold uppercase text-slate-400">Sourcing Notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{rfq.sourcingNotes}</p>
              </div>
            )}
          </AdminCard>

          {/* Attachments - TODO: uncomment after regenerating Prisma client */}
          {/* {rfq.attachments && rfq.attachments.length > 0 && (
            <AdminCard title={`Attachments (${rfq.attachments.length})`}>
              <div className="flex flex-wrap gap-2">
                {rfq.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs hover:border-orange-300 dark:border-slate-600 dark:bg-slate-700"
                  >
                    <span className="text-slate-400">📎</span>
                    <span className="max-w-[200px] truncate font-medium text-slate-700 dark:text-slate-200">{a.name}</span>
                    {a.size && <span className="text-slate-400">({Math.round(a.size / 1024)}KB)</span>}
                  </a>
                ))}
              </div>
            </AdminCard>
          )} */}

          {/* Quotes from Suppliers */}
          <AdminCard title={`Quotes (${rfq._count.quotes})`}>
            {rfq.quotes.length === 0 ? (
              <p className="text-sm text-slate-400">No quotes yet.</p>
            ) : (
              <div className="space-y-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {rfq.quotes.map((q: any) => (
                  <div
                    key={q.id}
                    className={`rounded-xl border p-4 ${q.isStale ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-600'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {q.supplier.companyName || q.supplier.name}
                        </div>
                        <div className="text-xs text-slate-500">{q.supplier.user?.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-orange-600">
                          {q.price} {q.currency}
                        </div>
                        <div className={`text-xs font-bold ${q.isStale ? 'text-amber-600' : 'text-slate-400'}`}>
                          {q.status}
                          {q.isStale && ' (STALE)'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      {q.moq && <div className="text-slate-500">MOQ: <span className="font-medium text-slate-700">{q.moq}</span></div>}
                      {q.leadTimeDays && <div className="text-slate-500">Lead time: <span className="font-medium text-slate-700">{q.leadTimeDays} days</span></div>}
                      {q.validUntil && <div className="text-slate-500">Valid until: <span className="font-medium text-slate-700">{new Date(q.validUntil).toLocaleDateString()}</span></div>}
                    </div>
                    {q.message && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-700/50">{q.message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          {/* Messages / Q&A */}
          {rfq.messages.length > 0 && (
            <AdminCard title={`Messages / Q&A (${rfq._count.messages})`}>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {rfq.messages.map((m: any) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-700">
                      {m.sender.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">{m.sender.name}</span>
                        <span className="text-[10px] uppercase text-slate-400">{m.sender.role}</span>
                        <span className="text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{m.content}</p>
                      {m.attachmentUrl && (
                        <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-orange-600 hover:underline">
                          📎 Attachment
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Moderation */}
          <AdminCard title="Moderation">
            <RfqModerationActions slug={rfq.slug} status={rfq.status} locale={locale} />
          </AdminCard>

          {/* Invited Suppliers */}
          <AdminCard title={`Invited Suppliers (${rfq._count.invites})`}>
            {rfq.invites.length === 0 ? (
              <p className="text-sm text-slate-400">No suppliers invited yet.</p>
            ) : (
              <ul className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {rfq.invites.map((i: any) => (
                  <li key={i.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-700/50">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{i.supplier.companyName || i.supplier.name}</div>
                      <div className="text-xs text-slate-500">{i.supplier.user?.email}</div>
                    </div>
                    <Link
                      href={`/${locale}/admin/suppliers/${i.supplier.id}`}
                      className="text-xs font-semibold text-orange-600 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
              <Link
                href={`/${locale}/admin/suppliers?rfq=${rfq.slug}`}
                className="inline-flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"
              >
                + Invite Suppliers
              </Link>
            </div>
          </AdminCard>

          {/* Public Link */}
          <AdminCard title="Public Link">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/${locale}/rfq/${rfq.slug}`}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-700"
              />
              <Link
                href={`/${locale}/rfq/${rfq.slug}`}
                target="_blank"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-orange-300 dark:border-slate-600 dark:bg-slate-800"
              >
                Open
              </Link>
            </div>
          </AdminCard>

          {/* Timestamps */}
          <AdminCard title="Timeline">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="font-medium text-slate-700">{new Date(rfq.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Updated</span>
                <span className="font-medium text-slate-700">{new Date(rfq.updatedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Published</span>
                <span className="font-medium text-slate-700">
                  {rfq.publishedAt ? new Date(rfq.publishedAt).toLocaleString() : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Extension Count</span>
                <span className="font-medium text-slate-700">{rfq.extensionCount}</span>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
