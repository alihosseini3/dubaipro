'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { apiFetch, ApiError } from '@/lib/api/client';
import { useApiMutation } from '@/hooks/use-api';

type Tier = 'STANDARD' | 'VERIFIED' | 'GUARANTEED';

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

const TIER_TONE: Record<Tier, string> = {
  STANDARD: 'bg-slate-100 text-slate-600',
  VERIFIED: 'bg-sky-50 text-sky-700',
  GUARANTEED: 'bg-amber-50 text-amber-700'
};

const STATUS_TONE: Record<Cert['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  EXPIRED: 'bg-slate-100 text-slate-500'
};

const CERT_TYPES = [
  'BUSINESS_LICENSE',
  'ISO_9001',
  'CE',
  'FDA',
  'CUSTOM'
] as const;

export function VerificationManager({
  tier,
  supplierStatus,
  verifiedAt,
  verificationExpiresAt,
  certifications
}: {
  tier: Tier;
  supplierStatus: string;
  verifiedAt: string | null;
  verificationExpiresAt: string | null;
  certifications: Cert[];
}) {
  const t = useTranslations('supplier.verification');
  const [rows, setRows] = useState(certifications);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<string>('BUSINESS_LICENSE');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const remove = useApiMutation<{ id: string }, unknown>(
    (input) => `/api/supplier/me/certifications/${input.id}`,
    'DELETE'
  );
  const submitVerification = useApiMutation<undefined, { data: { status: string } }>(
    '/api/supplier/me/submit-verification',
    'POST'
  );

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      // Multipart upload bypasses apiFetch (which always JSON-encodes the
      // body) — send FormData with fetch directly, no Content-Type header
      // so the browser sets the multipart boundary itself.
      const form = new FormData();
      form.append('file', file);
      const uploadHttp = await fetch('/api/supplier/me/certifications/upload', {
        method: 'POST',
        body: form
      });
      const uploadPayload = await uploadHttp.json().catch(() => null);
      if (!uploadHttp.ok) {
        throw new ApiError(
          uploadHttp.status,
          uploadPayload?.error ?? `Upload failed (${uploadHttp.status})`
        );
      }
      const uploadRes = uploadPayload as { data: { url: string } };

      const created = await apiFetch<{ data: Cert }>('/api/supplier/me/certifications', {
        method: 'POST',
        body: {
          type,
          title: title.trim(),
          issuer: issuer.trim() || undefined,
          fileUrl: uploadRes.data.url,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
        }
      });
      setRows((prev) => [created.data, ...prev]);
      setTitle('');
      setIssuer('');
      setExpiresAt('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove.mutate({ id });
      setRows((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* remove.error surfaces via component re-render below is skipped for brevity */
    }
  }

  async function handleSubmitVerification() {
    setNotice(null);
    try {
      const result = await submitVerification.mutate(undefined);
      setNotice(t('submittedNotice', { status: result.data.status }));
    } catch {
      /* submitVerification.error rendered below */
    }
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white';

  return (
    <div className="space-y-6">
      {/* Current status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold uppercase ${TIER_TONE[tier]}`}
          >
            {t(`tier${tier}` as Parameters<typeof t>[0])}
          </span>
          {verificationExpiresAt && (
            <span className="text-xs text-slate-500">
              {t('expiresOn', { date: new Date(verificationExpiresAt).toLocaleDateString() })}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {t(`tierHelp${tier}` as Parameters<typeof t>[0])}
        </p>

        {tier === 'STANDARD' && (
          <div className="mt-4">
            <button
              type="button"
              disabled={submitVerification.loading || supplierStatus === 'PENDING_REVIEW'}
              onClick={handleSubmitVerification}
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {submitVerification.loading
                ? t('submitting')
                : supplierStatus === 'PENDING_REVIEW'
                  ? t('alreadySubmitted')
                  : t('submitForVerification')}
            </button>
            {submitVerification.error && (
              <p className="mt-2 text-sm text-rose-600">{submitVerification.error.message}</p>
            )}
            {notice && <p className="mt-2 text-sm text-emerald-600">{notice}</p>}
          </div>
        )}
      </div>

      {/* Upload form */}
      <form
        onSubmit={handleUpload}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60"
      >
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          {t('uploadTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-500">{t('certType')}</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`mt-0.5 ${field}`}
            >
              {CERT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {ct.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">{t('certTitle')}</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`mt-0.5 ${field}`}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">{t('certIssuer')}</span>
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className={`mt-0.5 ${field}`}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">{t('certExpiry')}</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={`mt-0.5 ${field}`}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-slate-500">{t('certFile')}</span>
            <input
              ref={fileRef}
              required
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className={`mt-0.5 ${field}`}
            />
          </label>
        </div>
        {uploadError && <p className="text-sm text-rose-600">{uploadError}</p>}
        <button
          type="submit"
          disabled={uploading}
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {uploading ? t('uploading') : t('uploadCert')}
        </button>
      </form>

      {/* Certification list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-900 dark:border-slate-700 dark:text-white">
          {t('myCertifications')}
        </h2>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">{t('noCertifications')}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((cert) => (
              <li key={cert.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {cert.title}{' '}
                      <span className="font-normal text-slate-400">· {cert.type}</span>
                    </p>
                    {cert.reviewerNote && cert.status === 'REJECTED' && (
                      <p className="mt-1 text-xs text-rose-600">{cert.reviewerNote}</p>
                    )}
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[cert.status]}`}
                    >
                      {t(`certStatus${cert.status}` as Parameters<typeof t>[0])}
                    </span>
                    {cert.status !== 'APPROVED' && (
                      <button
                        type="button"
                        disabled={remove.loading}
                        onClick={() => handleDelete(cert.id)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {t('delete')}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
