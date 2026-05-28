'use client';

import { useState, type ReactNode } from 'react';

type Tab = {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
};

type Props = {
  tabs: Tab[];
  defaultKey?: string;
};

/**
 * Lightweight tab switcher used on the supplier profile page. Pure client
 * state — does NOT sync to the URL because each tab's content is already
 * server-rendered (server component children passed via `content`).
 */
export function SupplierTabs({ tabs, defaultKey }: Props) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key ?? '');
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition ${
                isActive
                  ? 'border-slate-900 font-semibold text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' ? (
                <span className="ms-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="pt-6">{current?.content}</div>
    </div>
  );
}
