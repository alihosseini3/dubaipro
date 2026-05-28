'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
function IconUsers() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a4 4 0 1 0 2.83-3.83" />
    </svg>
  );
}
function IconBar() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h3v-8H3zm5 0h3v-14H8zm5 0h3v-5h-3zm5 0h3v-10h-3z" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function IconClick() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

type Overview = {
  totalUsers: number;
  totalCampaigns: number;
  totalSent: number;
  openRate: number;
  clickRate: number;
};

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalFailed: number;
  openRate: number;
  clickRate: number;
  sentAt: string | null;
};

type AnalyticsData = {
  overview: Overview;
  campaigns: CampaignRow[];
  periodDays: number;
};

export function OverviewPanel() {
  const t = useTranslations('admin.campaigns');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/marketing/analytics?days=30')
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">{t('loading')}</p>;
  if (!data) return null;

  const { overview, campaigns } = data;

  const stats = [
    {
      label: t('overview.totalUsers'),
      value: overview.totalUsers.toLocaleString(),
      icon: IconUsers,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: t('overview.totalCampaigns'),
      value: overview.totalCampaigns.toLocaleString(),
      icon: IconBar,
      color: 'bg-violet-50 text-violet-600',
    },
    {
      label: t('overview.totalSent'),
      value: overview.totalSent.toLocaleString(),
      icon: IconSend,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: t('overview.openRate'),
      value: `${overview.openRate}%`,
      icon: IconMail,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: t('overview.clickRate'),
      value: `${overview.clickRate}%`,
      icon: IconClick,
      color: 'bg-rose-50 text-rose-600',
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">{t('overview.last30Days')}</p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className={`mb-3 inline-flex rounded-lg p-2 ${s.color}`}>
              <s.icon />
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent campaigns table */}
      {campaigns.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {t('tabs.campaigns')}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t('totalSent')}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t('openRate')}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t('clickRate')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.slice(0, 8).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-medium text-slate-800">
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {c.totalSent.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {c.openRate}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {c.clickRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
