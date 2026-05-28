'use client';

import Link from 'next/link';

import { useBuilder, type Viewport } from './BuilderContext';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

const VIEWPORTS: { id: Viewport; icon: string; title: string }[] = [
  { id: 'desktop', icon: 'M20 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM8 21h8m-4-4v4', title: 'Desktop' },
  { id: 'tablet',  icon: 'M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h6m6-18h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 3v18', title: 'Tablet' },
  { id: 'mobile',  icon: 'M12 18h.01M7 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z', title: 'Mobile' },
];

export function BuilderToolbar({ locale }: { locale: string }) {
  const t = useBuilder();
  const { state, dispatch, canUndo, canRedo, undo, redo, savePage } = t;
  const { page, dirty, saving, viewport } = state;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b border-white/10 bg-[#0F172A] px-4 shadow-xl">
      {/* Brand + breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F97316]">
          <Ic d="M4 6h16M4 12h16M4 18h7" className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-xs font-semibold text-white">{page.title}</p>
          <p className="text-[10px] text-slate-400">
            <Link href={`/${locale}/admin/pages`} className="hover:text-slate-200 transition">Pages</Link>
            {' / '}
            <span className="text-slate-300">Visual Builder</span>
          </p>
        </div>
      </div>

      <div className="flex-1" />

      {/* Viewport switcher */}
      <div className="hidden items-center gap-0.5 rounded-xl bg-slate-800 p-1 sm:flex">
        {VIEWPORTS.map((v) => (
          <button
            key={v.id}
            type="button"
            title={v.title}
            onClick={() => dispatch({ type: 'SET_VIEWPORT', viewport: v.id })}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
              viewport === v.id
                ? 'bg-[#F97316] text-white shadow'
                : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            <Ic d={v.icon} className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-slate-700" />

      {/* Undo / redo */}
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={undo} disabled={!canUndo} title="Undo"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30">
          <Ic d="M3 10h10a4 4 0 0 1 0 8H7M3 10l4-4M3 10l4 4" />
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="Redo"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30">
          <Ic d="M21 10H11a4 4 0 0 0 0 8h6M21 10l-4-4M21 10l-4 4" />
        </button>
      </div>

      <div className="h-5 w-px bg-slate-700" />

      {/* Status badge */}
      <span className={`hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex items-center gap-1.5 ${
        page.status === 'PUBLISHED'
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-amber-500/20 text-amber-400'
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${page.status === 'PUBLISHED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {page.status === 'PUBLISHED' ? 'Live' : 'Draft'}
      </span>

      {dirty && (
        <span className="hidden text-[11px] text-slate-500 sm:block">Unsaved</span>
      )}

      {/* Preview */}
      <a
        href={`/${locale}/${page.slug}`}
        target="_blank"
        rel="noopener"
        className="hidden items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white sm:flex"
      >
        <Ic d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" className="h-3.5 w-3.5" />
        Preview
      </a>

      {/* Save */}
      <button
        type="button"
        onClick={savePage}
        disabled={saving || !dirty}
        className="flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-orange-600 disabled:opacity-50"
      >
        <Ic d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8" className="h-4 w-4" />
        {saving ? 'Saving…' : 'Save'}
      </button>

      {/* Publish toggle */}
      <button
        type="button"
        onClick={() => {
          dispatch({
            type: 'UPDATE_PAGE',
            patch: { status: page.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' },
          });
        }}
        className={`hidden items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition sm:flex ${
          page.status === 'PUBLISHED'
            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        {page.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
      </button>

      {/* Panel toggles */}
      <div className="h-5 w-px bg-slate-700" />
      <button type="button" onClick={() => dispatch({ type: 'TOGGLE_LEFT' })}
        title="Toggle blocks panel"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          state.leftOpen ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
        }`}>
        <Ic d="M4 6h16M4 12h10M4 18h7" />
      </button>
      <button type="button" onClick={() => dispatch({ type: 'TOGGLE_RIGHT' })}
        title="Toggle properties panel"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          state.rightOpen ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
        }`}>
        <Ic d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
      </button>
    </header>
  );
}
