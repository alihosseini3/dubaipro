'use client';

import { useState, type ReactNode } from 'react';

import type { PageSectionType } from '@/lib/pages/types';

const SECTION_LABELS: Record<PageSectionType, string> = {
  HERO: 'Hero',
  RICH_TEXT: 'Rich Text',
  IMAGE_BANNER: 'Image Banner',
  CTA_BLOCK: 'CTA Block',
  FEATURES_GRID: 'Features Grid',
  FAQ: 'FAQ',
  SPACER: 'Spacer',
  PRODUCT_GRID: 'Product Grid',
  STATS: 'Stats',
  TRUST_SECTION: 'Trust Section',
  SUPPLIER_SHOWCASE: 'Supplier Showcase',
  BLOG_POSTS: 'Blog Posts',
  AUCTION_SHOWCASE: 'Auction Showcase',
};

const SECTION_ICONS: Record<PageSectionType, string> = {
  HERO: '🎯',
  RICH_TEXT: '📝',
  IMAGE_BANNER: '🖼',
  CTA_BLOCK: '🔘',
  FEATURES_GRID: '⚡',
  FAQ: '❓',
  SPACER: '⬜',
  PRODUCT_GRID: '🛍',
  STATS: '📊',
  TRUST_SECTION: '🏅',
  SUPPLIER_SHOWCASE: '🏭',
  BLOG_POSTS: '📰',
  AUCTION_SHOWCASE: '🔨',
};

type Props = {
  type: PageSectionType;
  isVisible: boolean;
  isDragging?: boolean;
  isOver?: boolean;
  onVisibilityToggle: () => void;
  onDelete: () => void;
  children: ReactNode;
};

export function SectionBlock({
  type,
  isVisible,
  isDragging = false,
  isOver = false,
  onVisibilityToggle,
  onDelete,
  children,
}: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all duration-200
        ${isDragging ? 'scale-[0.98] opacity-70 shadow-2xl' : ''}
        ${isOver ? 'border-orange-400 ring-2 ring-orange-100' : 'border-slate-200'}
        ${!isVisible ? 'opacity-60' : ''}
        bg-white shadow-sm`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <button
          type="button"
          className="cursor-grab touch-none text-slate-400 hover:text-slate-600"
          aria-label="Drag to reorder"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
          </svg>
        </button>

        <span className="text-base">{SECTION_ICONS[type]}</span>
        <span className="flex-1 text-sm font-semibold text-slate-800">
          {SECTION_LABELS[type]}
        </span>

        {!isVisible && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Hidden
          </span>
        )}

        <button
          type="button"
          onClick={onVisibilityToggle}
          title={isVisible ? 'Hide section' : 'Show section'}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition
            ${isVisible
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
        >
          {isVisible ? 'Visible' : 'Hidden'}
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600"
          title="Delete section"
          aria-label="Delete section"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          title={open ? 'Collapse' : 'Expand'}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <svg
            viewBox="0 0 20 20"
            className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {open && <div className="p-4">{children}</div>}
    </div>
  );
}
