'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';

type InviteInfo = {
  data: {
    supplierName: string;
    email: string;
    role: string;
    requiresAccount: boolean;
  };
};

type AcceptResult = { data: { supplierId: string; createdAccount: boolean } };

/**
 * Validates the invite token, then either joins directly (existing account —
 * the emailed token proves inbox control) or collects name/password to
 * create the employee account first. On success a session is already set by
 * the API, so we can navigate straight into the supplier dashboard.
 */
export function AcceptInviteCard({ locale, token }: { locale: string; token: string }) {
  const t = useTranslations('supplier.invite');
  const router = useRouter();

  const info = useApiQuery<InviteInfo>('/api/supplier/team/accept', {
    query: { token },
    enabled: token.length > 0
  });
  const accept = useApiMutation<
    { token: string; name?: string; password?: string; locale?: string },
    AcceptResult
  >('/api/supplier/team/accept', 'POST');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  if (!token) {
    return <ErrorCard message={t('missingToken')} />;
  }
  if (info.loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
        {t('checking')}
      </div>
    );
  }
  if (info.error || !info.data) {
    return <ErrorCard message={info.error?.message ?? t('invalid')} />;
  }

  const invite = info.data.data;

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    try {
      await accept.mutate(
        invite.requiresAccount
          ? { token, name: name.trim(), password, locale }
          : { token, locale }
      );
      router.push(`/${locale}/supplier`);
      router.refresh();
    } catch {
      /* accept.error rendered below */
    }
  }

  return (
    <form
      onSubmit={handleAccept}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-sm text-slate-700">
        {t('summary', { supplier: invite.supplierName, role: invite.role })}
      </p>
      <p className="mt-1 text-xs text-slate-500">{invite.email}</p>

      {invite.requiresAccount && (
        <div className="mt-4 space-y-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={accept.loading}
        className="mt-5 w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {accept.loading ? t('joining') : t('join')}
      </button>
      {accept.error && (
        <p className="mt-3 text-sm text-rose-600">{accept.error.message}</p>
      )}
    </form>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
      {message}
    </div>
  );
}
