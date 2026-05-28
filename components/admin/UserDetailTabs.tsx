'use client';

import { useState, type ReactNode } from 'react';

type Tab = {
  id: string;
  label: string;
  badge?: number;
  content: ReactNode;
};

type UserDetailTabsProps = {
  tabs: Tab[];
  defaultTabId?: string;
};

/**
 * Minimal tab switcher used on the user detail page. Kept client-only so
 * the URL doesn't change as the admin flicks between Profile / Orders /
 * Addresses — the page layout stays stable and back-navigation lands on
 * the list, not on a sub-tab.
 */
export function UserDetailTabs({ tabs, defaultTabId }: UserDetailTabsProps) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        className="flex gap-1 border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActiveId(tab.id)}
              className={
                'relative -mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ' +
                (isActive
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800')
              }
            >
              {tab.label}
              {typeof tab.badge === 'number' && (
                <span
                  className={
                    'inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ' +
                    (isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600')
                  }
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-6">
        {active?.content}
      </div>
    </div>
  );
}
