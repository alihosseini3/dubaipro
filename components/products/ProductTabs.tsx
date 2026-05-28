'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

type Tab = 'description' | 'specs' | 'reviews';

type Props = {
  description: string | null;
  specifications: ReactNode;
  reviews: ReactNode;
  reviewCount?: number;
};

/**
 * Tabbed content section under the buy box. Tabs are client-side
 * (state only) but the content for each tab is server-rendered and
 * passed as `ReactNode` so we keep SSR for SEO without re-fetching
 * on tab switch.
 *
 * The "Reviews" label includes a count badge when available — a
 * known conversion lift on PDPs.
 */
export function ProductTabs({
  description,
  specifications,
  reviews,
  reviewCount = 0
}: Props) {
  const t = useTranslations('products');
  const [tab, setTab] = useState<Tab>('description');

  const tabs: Array<{ id: Tab; label: string; badge?: number | null }> = [
    { id: 'description', label: t('tabs.description') },
    { id: 'specs', label: t('tabs.specifications') },
    { id: 'reviews', label: t('tabs.reviews'), badge: reviewCount }
  ];

  return (
    <section
      aria-label={t('tabs.description')}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50">
        {tabs.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              aria-current={active}
              className={`relative whitespace-nowrap px-5 py-3.5 text-sm font-semibold transition ${
                active
                  ? 'text-orange-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {entry.label}
                {entry.badge != null && entry.badge > 0 && (
                  <span
                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                      active
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {entry.badge}
                  </span>
                )}
              </span>
              {active && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-orange-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-5 sm:p-6">
        {tab === 'description' && (
          <div className="prose prose-slate max-w-none text-sm leading-7 text-slate-700">
            {description ? (
              <p className="whitespace-pre-line">{description}</p>
            ) : (
              <p className="text-slate-400">{t('descriptionEmpty')}</p>
            )}
          </div>
        )}
        {tab === 'specs' && <div>{specifications}</div>}
        {tab === 'reviews' && <div>{reviews}</div>}
      </div>
    </section>
  );
}
