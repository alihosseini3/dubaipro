'use client';

import type { PageDTO } from '@/lib/pages/service';
import { BlockLibraryPanel } from './BlockLibraryPanel';
import { BuilderCanvas }     from './BuilderCanvas';
import { BuilderProvider, useBuilder } from './BuilderContext';
import { BuilderToolbar }    from './BuilderToolbar';
import { PropertiesPanel }   from './PropertiesPanel';
import { ToastStack }        from './ToastStack';

/* ─── Inner layout ───────────────────────────────────────────────────── */

function BuilderLayout({ locale }: { locale: string }) {
  const { state } = useBuilder();
  const { leftOpen, rightOpen } = state;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#020617]">
      {/* Top toolbar */}
      <BuilderToolbar locale={locale} />

      {/* Toast notifications */}
      <ToastStack />

      {/* Three-panel body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: Block library */}
        <aside
          className={`shrink-0 overflow-hidden border-r border-white/10 transition-all duration-300 ${
            leftOpen ? 'w-64' : 'w-0'
          }`}
        >
          {leftOpen && <BlockLibraryPanel />}
        </aside>

        {/* Center: Canvas */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <BuilderCanvas locale={locale} />
        </main>

        {/* Right: Properties */}
        <aside
          className={`shrink-0 overflow-hidden border-l border-slate-200 transition-all duration-300 ${
            rightOpen ? 'w-80' : 'w-0'
          }`}
        >
          {rightOpen && <PropertiesPanel locale={locale} />}
        </aside>
      </div>
    </div>
  );
}

/* ─── Public export ──────────────────────────────────────────────────── */

export function VisualPageBuilder({
  initial,
  locale,
}: {
  initial: PageDTO;
  locale:  string;
}) {
  return (
    <BuilderProvider initial={initial} locale={locale}>
      <BuilderLayout locale={locale} />
    </BuilderProvider>
  );
}
