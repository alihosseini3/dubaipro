'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';

import { MarketingSettingsForm } from '@/components/admin/MarketingSettingsForm';
import { CampaignForm } from './CampaignForm';
import { CampaignList } from './CampaignList';
import { OverviewPanel } from './OverviewPanel';
import { SegmentsPanel } from './SegmentsPanel';

type Tab = 'overview' | 'campaigns' | 'automation' | 'segments' | 'settings';

type EditingCampaign = {
  id: string;
  name: string;
  channel: 'EMAIL' | 'WHATSAPP';
  subject: string | null;
  body: string;
  segment: string | null;
  couponCode: string | null;
  scheduledAt: string | null;
};

export function MarketingHub() {
  const t = useTranslations('admin.campaigns');
  const locale = useLocale();

  const [tab, setTab] = useState<Tab>('overview');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EditingCampaign | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('tabs.overview') },
    { key: 'campaigns', label: t('tabs.campaigns') },
    { key: 'automation', label: t('tabs.automation') },
    { key: 'segments', label: t('tabs.segments') },
    { key: 'settings', label: t('tabs.settings') },
  ];

  function openNew(segment?: string) {
    setEditing(
      segment
        ? {
            id: '',
            name: '',
            channel: 'EMAIL',
            subject: null,
            body: '',
            segment,
            couponCode: null,
            scheduledAt: null,
          }
        : null,
    );
    setShowForm(true);
    setTab('campaigns');
  }

  function openEdit(c: EditingCampaign) {
    setEditing(c);
    setShowForm(true);
  }

  function onSaved() {
    setShowForm(false);
    setEditing(null);
    setRefreshSignal((n) => n + 1);
  }

  function onCancel() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-slate-200">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => {
              setTab(tb.key);
              if (tb.key !== 'campaigns') {
                setShowForm(false);
                setEditing(null);
              }
            }}
            className={[
              'px-4 py-2.5 text-[13px] font-medium transition-colors',
              tab === tb.key
                ? 'border-b-2 border-orange-500 text-orange-600'
                : 'text-slate-500 hover:text-slate-900',
            ].join(' ')}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && <OverviewPanel />}

      {/* Campaigns */}
      {tab === 'campaigns' && (
        <div className="space-y-4">
          {!showForm && (
            <div className="flex justify-end">
              <button
                onClick={() => openNew()}
                className="rounded-xl bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600 active:scale-95"
              >
                + {t('new')}
              </button>
            </div>
          )}

          {showForm ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <CampaignForm
                initial={
                  editing
                    ? {
                        id: editing.id || undefined,
                        name: editing.name,
                        channel: editing.channel,
                        subject: editing.subject ?? undefined,
                        body: editing.body,
                        segment: editing.segment ?? undefined,
                        couponCode: editing.couponCode ?? undefined,
                        scheduledAt: editing.scheduledAt ?? undefined,
                      }
                    : undefined
                }
                onSaved={onSaved}
                onCancel={onCancel}
              />
            </div>
          ) : (
            <CampaignList
              onEdit={(c) =>
                openEdit({
                  id: c.id,
                  name: c.name,
                  channel: c.channel,
                  subject: c.subject,
                  body: '',
                  segment: c.segment,
                  couponCode: null,
                  scheduledAt: c.scheduledAt,
                })
              }
              refreshSignal={refreshSignal}
            />
          )}
        </div>
      )}

      {/* Automation */}
      {tab === 'automation' && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-800">{t('automation.link')}</p>
            <p className="mt-0.5 text-[13px] text-slate-400">Manage event-triggered automations in the dedicated panel</p>
          </div>
          <Link
            href={`/${locale}/admin/automation`}
            className="mt-1 rounded-xl bg-orange-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-orange-600"
          >
            /admin/automation →
          </Link>
        </div>
      )}

      {/* Segments */}
      {tab === 'segments' && (
        <SegmentsPanel
          onCreateCampaign={(segment) => openNew(segment)}
        />
      )}

      {/* Settings */}
      {tab === 'settings' && <MarketingSettingsForm />}
    </div>
  );
}
