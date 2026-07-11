'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useApiMutation } from '@/hooks/use-api';

type Audience = 'ALL' | 'BUYERS' | 'SUPPLIERS';

const AUDIENCES: Audience[] = ['ALL', 'BUYERS', 'SUPPLIERS'];

export function BroadcastComposer() {
  const t = useTranslations('admin.broadcast');
  const send = useApiMutation<
    { audience: Audience; message: string; link?: string },
    { data: { recipients: number } }
  >('/api/admin/notifications/broadcast', 'POST');

  const [audience, setAudience] = useState<Audience>('ALL');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [sentTo, setSentTo] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSentTo(null);
    try {
      const result = await send.mutate({
        audience,
        message: message.trim(),
        ...(link.trim() ? { link: link.trim() } : {})
      });
      setSentTo(result.data.recipients);
      setMessage('');
      setLink('');
    } catch {
      /* send.error rendered below */
    }
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none';

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t('audience')}</span>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as Audience)}
          className={`mt-1 ${field}`}
        >
          {AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {t(`audiences.${a}` as Parameters<typeof t>[0])}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t('message')}</span>
        <textarea
          required
          minLength={3}
          maxLength={500}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('messagePlaceholder')}
          className={`mt-1 ${field}`}
        />
        <span className="mt-1 block text-end text-[11px] text-slate-400">
          {message.length}/500
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t('link')}</span>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="/products"
          className={`mt-1 ${field}`}
        />
        <span className="mt-1 block text-[11px] text-slate-400">{t('linkHint')}</span>
      </label>

      {send.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {send.error.message}
        </p>
      )}
      {sentTo !== null && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t('sentTo', { count: sentTo })}
        </p>
      )}

      <button
        type="submit"
        disabled={send.loading || message.trim().length < 3}
        className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
      >
        {send.loading ? t('sending') : t('send')}
      </button>
    </form>
  );
}
