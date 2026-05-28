'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';

import type { PageSectionDTO } from '@/lib/pages/service';
import { useBuilder, VIEWPORT_WIDTHS } from './BuilderContext';
import { CanvasSection } from './CanvasSection';

const Ic = ({ d, className = 'h-5 w-5' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

export function BuilderCanvas({ locale = 'en' }: { locale?: string }) {
  const { state, dispatch, reorder, addSection } = useBuilder();
  const { sections, viewport } = state;
  const dir = ['fa', 'ar', 'ur'].includes(locale) ? 'rtl' : 'ltr';
  const [activeSection, setActiveSection] = useState<PageSectionDTO | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveSection(sections.find((s) => s.id === active.id) ?? null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveSection(null);
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s) => s.id === active.id);
    const newIdx = sections.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(sections, oldIdx, newIdx).map((s, i) => ({ ...s, order: i }));
    dispatch({ type: 'SET_SECTIONS', sections: reordered });
    void reorder(reordered.map((s) => s.id));
  }

  const canvasWidth = VIEWPORT_WIDTHS[viewport];
  const isConstrained = viewport !== 'desktop';

  return (
    <div className="flex h-full flex-col items-center overflow-auto bg-[#020617] px-4 py-6">
      {/* Viewport label */}
      {isConstrained && (
        <div className="mb-3 rounded-full bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-400">
          {viewport === 'tablet' ? '768px — Tablet' : '390px — Mobile'}
        </div>
      )}

      {/* Canvas frame */}
      <div
        className="relative flex w-full flex-col transition-all duration-300"
        style={{ maxWidth: canvasWidth }}
        dir={dir}
      >
        {/* Shadow chrome for constrained viewports */}
        {isConstrained && (
          <div className="pointer-events-none absolute -inset-3 rounded-3xl border border-slate-700/50 shadow-2xl" />
        )}

        <div className="min-h-[calc(100vh-10rem)] rounded-2xl bg-white shadow-2xl">
          {/* Empty state */}
          {sections.length === 0 && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Ic d="M4 6h16M4 12h16M4 18h7" className="h-8 w-8 text-slate-300" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-700">Your canvas is empty</p>
                <p className="mt-1 text-sm text-slate-400">Add blocks from the left panel to get started</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {(['HERO', 'RICH_TEXT', 'CTA_BLOCK'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => void addSection(type)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-[#F97316] hover:text-[#F97316]"
                  >
                    + {type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DnD sortable sections */}
          {sections.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={sections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3 p-4">
                  {sections.map((section) => (
                    <CanvasSection key={section.id} section={section} />
                  ))}
                </div>
              </SortableContext>

              {/* Drag overlay ghost */}
              <DragOverlay>
                {activeSection && (
                  <div className="rounded-xl border-2 border-[#F97316] bg-white/90 p-3 shadow-2xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                      <span>{activeSection.type.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* Drop zone hint at bottom */}
          {sections.length > 0 && (
            <div
              className="m-4 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-6 text-xs text-slate-400 transition hover:border-[#F97316]/50 hover:text-[#F97316] cursor-pointer"
              onClick={() => {}}
            >
              + Add section below
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
