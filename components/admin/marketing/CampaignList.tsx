'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Campaign = {
  id: string;
  name: string;
  channel: 'EMAIL' | 'WHATSAPP';
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'CANCELLED';
  subject: string | null;
  segment: string | null;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  SCHEDULED: { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  SENDING:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CANCELLED: { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400' },
};

type Props = {
  onEdit: (campaign: Campaign) => void;
  refreshSignal: number;
};

export function CampaignList({ onEdit, refreshSignal }: Props) {
  const t = useTranslations('admin.campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/marketing/campaigns?pageSize=50');
      const json = await res.json();
      setCampaigns(json.campaigns ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshSignal]);

  async function handleSend(id: string, recipientCount: number) {
    if (!confirm(t('confirmSend', { count: recipientCount }))) return;
    setSendingId(id);
    try {
      await fetch(`/api/admin/marketing/campaigns/${id}/send`, {
        method: 'POST',
      });
      await load();
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    await fetch(`/api/admin/marketing/campaigns/${id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">{t('loading')}</p>;

  if (campaigns.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l18-7v16L3 13z" />
          </svg>
        </div>
        <p className="text-[14px] font-semibold text-slate-700">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <table className="min-w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">{t('name')}</th>
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">{t('channel')}</th>
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">{t('status')}</th>
            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">{t('totalRecipients')}</th>
            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">{t('openRate')}</th>
            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">{t('clickRate')}</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {campaigns.map((c) => {
            const openRate =
              c.totalSent > 0
                ? Math.round((c.totalOpened / c.totalSent) * 100)
                : 0;
            const clickRate =
              c.totalSent > 0
                ? Math.round((c.totalClicked / c.totalSent) * 100)
                : 0;
            const canSend = c.status === 'DRAFT' || c.status === 'SCHEDULED';
            const canEdit =
              c.status !== 'SENDING' && c.status !== 'COMPLETED';

            const sc = STATUS_COLORS[c.status];
            return (
              <tr
                key={c.id}
                className="border-b border-slate-50 transition-colors last:border-0 hover:bg-orange-500/[0.03]"
              >
                <td className="px-6 py-3.5">
                  <p className="font-medium text-slate-800">{c.name}</p>
                  {c.subject && (
                    <p className="mt-0.5 max-w-[200px] truncate text-[11px] text-slate-400">
                      {c.subject}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                    {c.channel === 'EMAIL' ? t('channelEmail') : t('channelWhatsapp')}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {sc ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${sc.bg} ${sc.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                      {t(c.status.toLowerCase() as Parameters<typeof t>[0])}
                    </span>
                  ) : c.status}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-700">
                  {c.totalRecipients > 0 ? c.totalRecipients.toLocaleString() : '—'}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-700">
                  {c.totalSent > 0 ? `${openRate}%` : '—'}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-700">
                  {c.totalSent > 0 ? `${clickRate}%` : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {canSend && (
                      <button
                        onClick={() => handleSend(c.id, c.totalRecipients)}
                        disabled={sendingId === c.id}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                      >
                        {sendingId === c.id ? t('sending') : t('send')}
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => onEdit(c)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        {t('edit')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="rounded-lg border border-red-100 px-3 py-1.5 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {total > 50 && (
        <div className="border-t border-slate-100 px-6 py-3">
          <p className="text-[12px] text-slate-400">Showing 50 of {total.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
