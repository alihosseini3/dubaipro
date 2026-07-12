'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { AdminCard } from '@/components/admin/AdminCard';
import { useApiMutation } from '@/hooks/use-api';

type Cert = {
  id: string;
  type: string;
  title: string;
  issuer: string | null;
  fileUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  issuedAt: string | null;
  expiresAt: string | null;
  reviewerNote: string | null;
};

const STATUS_TONE: Record<Cert['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  EXPIRED: 'bg-slate-100 text-slate-500'
};

/** Admin approve/reject queue for supplier-uploaded certifications. */
export function SupplierCertificationsReview({
  supplierId,
  certifications
}: {
  supplierId: string;
  certifications: Cert[];
}) {
  const t = useTranslations('adminSuppliers');
  const [rows, setRows] = useState(certifications);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const review = useApiMutation<
    { certId: string; action: 'approve' | 'reject'; note?: string },
    { data: Cert }
  >(
    (input) =>
      `/api/admin/suppliers/${supplierId}/certifications/${input.certId}/review`,
    'POST'
  );

  async function decide(certId: string, action: 'approve' | 'reject') {
    try {
      const result = await review.mutate({
        certId,
        action,
        ...(action === 'reject' ? { note: note.trim() } : {})
      });
      setRows((prev) => prev.map((c) => (c.id === certId ? result.data : c)));
      setRejectingId(null);
      setNote('');
    } catch {
      /* review.error rendered below */
    }
  }

  if (rows.length === 0) {
    return (
      <AdminCard title={t('sectionCertifications')}>
        <p className="text-sm text-slate-400">{t('noCertifications')}</p>
      </AdminCard>
    );
  }

  return (
    <AdminCard title={t('sectionCertifications')}>
      {review.error && (
        <p className="mb-3 text-xs font-medium text-rose-600">{review.error.message}</p>
      )}
      <ul className="divide-y divide-slate-100">
        {rows.map((cert) => (
          <li key={cert.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {cert.title}{' '}
                  <span className="font-normal text-slate-400">· {cert.type}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {cert.issuer ?? '—'}
                  {cert.expiresAt &&
                    ` · ${t('expiresOn', { date: new Date(cert.expiresAt).toLocaleDateString() })}`}
                </p>
                {cert.reviewerNote && (
                  <p className="mt-1 text-xs text-rose-600">{cert.reviewerNote}</p>
                )}
              </div>
              <div className="flex flex-none items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[cert.status]}`}
                >
                  {t(`certStatus${cert.status}` as Parameters<typeof t>[0])}
                </span>
                <a
                  href={cert.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('viewDocument')}
                </a>
              </div>
            </div>

            {cert.status === 'PENDING' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={review.loading}
                  onClick={() => decide(cert.id, 'approve')}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t('approve')}
                </button>
                <button
                  type="button"
                  disabled={review.loading}
                  onClick={() => setRejectingId(rejectingId === cert.id ? null : cert.id)}
                  className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {t('reject')}
                </button>
                {rejectingId === cert.id && (
                  <>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t('rejectReason')}
                      className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-rose-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={review.loading || note.trim().length < 3}
                      onClick={() => decide(cert.id, 'reject')}
                      className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      {t('confirmReject')}
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}
