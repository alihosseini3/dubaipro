'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS }         from '@dnd-kit/utilities';

import type { PageSectionDTO } from '@/lib/pages/service';
import type { PageSectionType } from '@/lib/pages/types';
import { useBuilder } from './BuilderContext';

/* ─── Block meta ─────────────────────────────────────────────────────── */

const LABELS: Record<PageSectionType, string> = {
  HERO:              'Hero',
  RICH_TEXT:         'Rich Text',
  IMAGE_BANNER:      'Image Banner',
  CTA_BLOCK:         'CTA Block',
  FEATURES_GRID:     'Features Grid',
  FAQ:               'FAQ',
  SPACER:            'Spacer',
  PRODUCT_GRID:      'Product Grid',
  STATS:             'Stats',
  TRUST_SECTION:     'Trust Section',
  SUPPLIER_SHOWCASE: 'Supplier Showcase',
  BLOG_POSTS:        'Blog Posts',
  AUCTION_SHOWCASE:  'Auction Showcase',
};

const ICONS: Record<PageSectionType, string> = {
  HERO:              '🎯',
  RICH_TEXT:         '📝',
  IMAGE_BANNER:      '🖼',
  CTA_BLOCK:         '🔘',
  FEATURES_GRID:     '⚡',
  FAQ:               '❓',
  SPACER:            '↕',
  PRODUCT_GRID:      '🛍',
  STATS:             '📊',
  TRUST_SECTION:     '🏅',
  SUPPLIER_SHOWCASE: '🏭',
  BLOG_POSTS:        '📰',
  AUCTION_SHOWCASE:  '🔨',
};

/* ─── Section height map (preview skeleton) ─────────────────────────── */
const HEIGHT: Partial<Record<PageSectionType, string>> = {
  HERO:          'h-40',
  IMAGE_BANNER:  'h-32',
  RICH_TEXT:     'h-20',
  FEATURES_GRID: 'h-28',
  FAQ:           'h-24',
  CTA_BLOCK:     'h-24',
  STATS:         'h-20',
  TRUST_SECTION: 'h-16',
  SPACER:        'h-8',
  PRODUCT_GRID:  'h-36',
  SUPPLIER_SHOWCASE: 'h-28',
  BLOG_POSTS:    'h-28',
  AUCTION_SHOWCASE:  'h-32',
};

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

/* ─── Section skeleton preview ───────────────────────────────────────── */

function SectionSkeleton({ type, config }: { type: PageSectionType; config: Record<string, unknown> }) {
  const h = HEIGHT[type] ?? 'h-20';
  const heading = (config.heading ?? config.html ?? '') as string;

  return (
    <div className={`w-full ${h} overflow-hidden rounded-lg bg-slate-100 px-4 py-3 text-left`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-lg">{ICONS[type]}</span>
        <div className="min-w-0 flex-1">
          {heading ? (
            <p className="truncate text-sm font-semibold text-slate-700">
              {String(heading).replace(/<[^>]+>/g, '').slice(0, 60)}
            </p>
          ) : (
            <div className="h-3 w-32 rounded bg-slate-200" />
          )}
          <div className="mt-2 space-y-1.5">
            <div className="h-2 w-3/4 rounded bg-slate-200/70" />
            <div className="h-2 w-1/2 rounded bg-slate-200/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CanvasSection ──────────────────────────────────────────────────── */

export function CanvasSection({ section }: { section: PageSectionDTO }) {
  const { state, dispatch, deleteSection, saveSection } = useBuilder();
  const isSelected = state.selectedId === section.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => dispatch({ type: 'SELECT', id: isSelected ? null : section.id })}
      className={`group relative cursor-pointer rounded-xl border-2 transition-all duration-200 ${
        isDragging ? 'shadow-2xl ring-2 ring-[#F97316]' : ''
      } ${
        isSelected
          ? 'border-[#F97316] shadow-lg shadow-orange-500/10'
          : 'border-transparent hover:border-slate-200'
      } ${!section.isVisible ? 'opacity-50' : ''}`}
    >
      {/* Drag handle bar */}
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="absolute -top-px left-1/2 hidden -translate-x-1/2 -translate-y-full cursor-grab items-center gap-1 rounded-t-lg bg-[#F97316] px-2 py-0.5 group-hover:flex"
        aria-label="Drag to reorder"
      >
        <Ic d="M9 5h2M9 12h2M9 19h2M13 5h2M13 12h2M13 19h2" className="h-3 w-3 text-white" />
        <span className="text-[10px] font-bold text-white">{LABELS[section.type]}</span>
      </div>

      {/* Section header */}
      <div className={`flex items-center gap-2 rounded-t-xl px-3 py-1.5 transition ${
        isSelected ? 'bg-[#F97316]/10' : 'bg-slate-50 group-hover:bg-slate-100'
      }`}>
        <span className="text-base">{ICONS[section.type]}</span>
        <span className={`flex-1 text-[13px] font-semibold ${isSelected ? 'text-[#F97316]' : 'text-slate-700'}`}>
          {LABELS[section.type]}
        </span>
        {!section.isVisible && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">hidden</span>
        )}
        {/* Quick actions (visible on hover/select) */}
        <div className={`flex items-center gap-0.5 transition ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={(e) => e.stopPropagation()}>
          <ActionBtn
            title={section.isVisible ? 'Hide' : 'Show'}
            onClick={() => dispatch({ type: 'TOGGLE_VISIBLE', id: section.id })}
            icon={section.isVisible
              ? 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22'
              : 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'}
          />
          <ActionBtn
            title="Duplicate"
            onClick={() => dispatch({ type: 'DUPLICATE', id: section.id })}
            icon="M8 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3m-2 11h6a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2z"
          />
          <ActionBtn
            title="Delete"
            onClick={() => { if (confirm('Delete this section?')) void deleteSection(section.id); }}
            icon="M3 6h18M8 6V4h8v2M19 6v14H5V6"
            danger
          />
        </div>
      </div>

      {/* Visual preview body */}
      <div className="overflow-hidden rounded-b-xl bg-white p-3">
        <SectionSkeleton type={section.type} config={section.config as Record<string, unknown>} />
      </div>

      {/* Selected ring */}
      {isSelected && (
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[#F97316]" />
      )}
    </div>
  );
}

function ActionBtn({
  icon, title, onClick, danger,
}: {
  icon: string; title: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
        danger
          ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
      }`}
    >
      <Ic d={icon} className="h-3.5 w-3.5" />
    </button>
  );
}
