import type { Metadata } from 'next';

import { FilterSettingsForm } from '@/components/admin/FilterSettingsForm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getFilterSettings } from '@/lib/filters/settings';

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = { title: 'Filter Settings' };

export default async function AdminFilterSettingsPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, '/admin/settings/filters');

  const settings = await getFilterSettings();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-900 to-indigo-700 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.553.894l-4 2A1 1 0 017 17v-6.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold">Filter Settings</h1>
            <p className="mt-0.5 text-sm text-indigo-200">
              Control which filters appear on product listing and category pages
            </p>
          </div>
        </div>
      </header>

      {/* Info banner */}
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p>
          Changes take effect immediately on all storefronts. Price, brand and supplier filters are
          only displayed when the category or search results contain relevant data.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <FilterSettingsForm initial={settings} />
      </div>
    </div>
  );
}
