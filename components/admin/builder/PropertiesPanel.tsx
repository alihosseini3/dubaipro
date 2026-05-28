'use client';

import { useEffect, useRef, useState } from 'react';

import { SectionConfigEditor }  from '@/components/admin/pages/SectionEditors';
import { SeoPanel }              from '@/components/admin/pages/SeoPanel';
import type { SectionConfig }    from '@/lib/pages/service';
import type { PageSectionType }  from '@/lib/pages/types';
import { useBuilder }            from './BuilderContext';

/* ─── Tab ─────────────────────────────────────────────────────────────── */

type Tab = 'section' | 'page' | 'seo';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

/* ─── Section properties ─────────────────────────────────────────────── */

function SectionProperties({
  section,
  dir,
}: {
  section: { id: string; type: PageSectionType; config: SectionConfig };
  dir: 'ltr' | 'rtl';
}) {
  const { saveSection } = useBuilder();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(cfg: SectionConfig) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveSection(section.id, cfg);
    }, 500);
  }

  return (
    <div className="space-y-1">
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
        <Ic d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs font-medium text-slate-600">
          {section.type.replace(/_/g, ' ')} Properties
        </span>
      </div>
      <SectionConfigEditor
        type={section.type}
        config={section.config}
        onChange={handleChange}
        dir={dir}
      />
    </div>
  );
}

/* ─── Page settings ──────────────────────────────────────────────────── */

const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function PageSettings() {
  const { state, dispatch, savePage } = useBuilder();
  const { page } = state;

  return (
    <div className="space-y-4">
      <Field label="Title">
        <input
          value={page.title}
          onChange={(e) => dispatch({ type: 'UPDATE_PAGE', patch: { title: e.target.value } })}
          className={inputCls}
          maxLength={120}
        />
      </Field>
      <Field label="Slug" hint="URL path for this page">
        <input
          value={page.slug}
          onChange={(e) => dispatch({ type: 'UPDATE_PAGE', patch: { slug: e.target.value } })}
          className={inputCls}
          maxLength={96}
        />
      </Field>
      <Field label="Status">
        <select
          value={page.status}
          onChange={(e) => dispatch({ type: 'UPDATE_PAGE', patch: { status: e.target.value as 'DRAFT' | 'PUBLISHED' } })}
          className={inputCls}
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </Field>
      <Field label="Locale" hint="Leave empty for all locales">
        <select
          value={page.locale}
          onChange={(e) => dispatch({ type: 'UPDATE_PAGE', patch: { locale: e.target.value } })}
          className={inputCls}
        >
          <option value="">— All locales —</option>
          <option value="en">English</option>
          <option value="fa">فارسی</option>
          <option value="ar">العربية</option>
          <option value="ur">اردو</option>
        </select>
      </Field>
      <button
        type="button"
        onClick={() => void savePage()}
        disabled={state.saving}
        className="w-full rounded-xl bg-[#F97316] py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
      >
        {state.saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        <Ic d="M15 15l6 6m-11-4a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" className="h-6 w-6 text-slate-300" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600">Nothing selected</p>
        <p className="mt-1 text-xs text-slate-400">Click a section on the canvas to edit its properties</p>
      </div>
    </div>
  );
}

/* ─── PropertiesPanel ────────────────────────────────────────────────── */

export function PropertiesPanel({ locale }: { locale: string }) {
  const { state, saveSeo } = useBuilder();
  const { sections, selectedId, seo, page } = state;
  const [tab, setTab] = useState<Tab>('section');
  const dir = ['fa', 'ar', 'ur'].includes(locale) ? 'rtl' : 'ltr';

  const selected = sections.find((s) => s.id === selectedId);

  useEffect(() => {
    if (selected) setTab('section');
  }, [selected?.id]);

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'section', icon: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z', label: 'Block' },
    { id: 'page',    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z', label: 'Page' },
    { id: 'seo',     icon: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',                  label: 'SEO' },
  ];

  return (
    <aside className="flex h-full flex-col bg-white text-slate-900">
      {/* Header */}
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Properties</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-100 bg-slate-50">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
              tab === t.id
                ? 'border-b-2 border-[#F97316] text-[#F97316]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Ic d={t.icon} className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === 'section' && (
          selected
            ? <SectionProperties section={selected as { id: string; type: PageSectionType; config: SectionConfig }} dir={dir} />
            : <EmptyState />
        )}

        {tab === 'page' && <PageSettings />}

        {tab === 'seo' && (
          <SeoPanel
            page={page}
            seo={seo}
            onSave={saveSeo}
            saving={false}
          />
        )}
      </div>
    </aside>
  );
}
