'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-3 w-3'} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}

type SegmentStat = {
  segment: string;
  count: number;
  emailCount: number;
  whatsappCount: number;
};

const SEGMENT_LABEL_KEYS: Record<string, string> = {
  ALL: 'segmentAll',
  NEW: 'segmentNew',
  REPEAT: 'segmentRepeat',
  HIGH_VALUE: 'segmentHighValue',
  INACTIVE: 'segmentInactive',
};

const SEGMENT_COLORS: Record<string, string> = {
  ALL: 'bg-slate-100 text-slate-700',
  NEW: 'bg-blue-100 text-blue-700',
  REPEAT: 'bg-emerald-100 text-emerald-700',
  HIGH_VALUE: 'bg-amber-100 text-amber-700',
  INACTIVE: 'bg-rose-100 text-rose-700',
};

type Props = {
  onCreateCampaign?: (segment: string) => void;
};

export function SegmentsPanel({ onCreateCampaign }: Props) {
  const t = useTranslations('admin.campaigns');
  const [stats, setStats] = useState<SegmentStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/marketing/segments')
      .then((r) => r.json())
      .then((j) => setStats(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">{t('loading')}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[18px] font-semibold text-slate-900">
          {t('segments.title')}
        </h2>
        <p className="mt-0.5 text-[13px] text-slate-500">{t('segments.subtitle')}</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {t('segments.segment')}
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {t('segments.users')}
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {t('segments.emailReach')}
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {t('segments.waReach')}
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {stats.map((row, i) => (
              <tr
                key={row.segment}
                className={[
                  'transition-colors hover:bg-orange-500/[0.03]',
                  i % 2 === 1 ? 'bg-slate-50/30' : 'bg-white',
                ].join(' ')}
              >
                <td className="px-6 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${SEGMENT_COLORS[row.segment] ?? 'bg-slate-100 text-slate-700'}`}
                  >
                    <IconUsers className="h-3 w-3" />
                    {t(SEGMENT_LABEL_KEYS[row.segment] as Parameters<typeof t>[0] ?? 'segmentAll')}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                  {row.count.toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-600">
                  {row.emailCount.toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-600">
                  {row.whatsappCount.toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {row.segment !== 'ALL' && (
                    <button
                      onClick={() => onCreateCampaign?.(row.segment)}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-orange-600"
                    >
                      {t('segments.createCampaign')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
