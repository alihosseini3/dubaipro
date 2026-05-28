'use client';

import { useState } from 'react';

import type { PageSectionType } from '@/lib/pages/types';
import { useBuilder } from './BuilderContext';

/* ─── Block catalogue ──────────────────────────────────────────────────── */

type BlockDef = {
  type:     PageSectionType;
  label:    string;
  icon:     string;
  category: string;
  desc:     string;
};

const BLOCKS: BlockDef[] = [
  { type: 'HERO',              label: 'Hero',              icon: '🎯', category: 'Layout',    desc: 'Full-width hero with CTA' },
  { type: 'IMAGE_BANNER',      label: 'Image Banner',      icon: '🖼',  category: 'Layout',    desc: 'Full-bleed image banner' },
  { type: 'SPACER',            label: 'Spacer',            icon: '↕',  category: 'Layout',    desc: 'Vertical spacing' },
  { type: 'RICH_TEXT',         label: 'Rich Text',         icon: '📝', category: 'Content',   desc: 'WYSIWYG text editor' },
  { type: 'FEATURES_GRID',     label: 'Features Grid',     icon: '⚡', category: 'Content',   desc: 'Icon + title grid' },
  { type: 'FAQ',               label: 'FAQ',               icon: '❓', category: 'Content',   desc: 'Accordion Q&A' },
  { type: 'STATS',             label: 'Stats',             icon: '📊', category: 'Content',   desc: 'Key numbers section' },
  { type: 'TRUST_SECTION',     label: 'Trust Section',     icon: '🏅', category: 'Content',   desc: 'Trust badges / logos' },
  { type: 'CTA_BLOCK',         label: 'CTA Block',         icon: '🔘', category: 'Marketing', desc: 'Call-to-action banner' },
  { type: 'PRODUCT_GRID',      label: 'Product Grid',      icon: '🛍',  category: 'Commerce',  desc: 'Product listing grid' },
  { type: 'SUPPLIER_SHOWCASE', label: 'Supplier Showcase', icon: '🏭', category: 'Commerce',  desc: 'Featured suppliers' },
  { type: 'BLOG_POSTS',        label: 'Blog Posts',        icon: '📰', category: 'Commerce',  desc: 'Latest articles' },
  { type: 'AUCTION_SHOWCASE',  label: 'Auction Showcase',  icon: '🔨', category: 'Commerce',  desc: 'Live auction cards' },
];

const CATEGORIES = ['All', ...Array.from(new Set(BLOCKS.map((b) => b.category)))];

/* ─── Component ────────────────────────────────────────────────────────── */

export function BlockLibraryPanel() {
  const { addSection } = useBuilder();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [adding, setAdding] = useState<string | null>(null);

  const filtered = BLOCKS.filter((b) => {
    const matchCat = cat === 'All' || b.category === cat;
    const matchSearch = !search || b.label.toLowerCase().includes(search.toLowerCase()) || b.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  async function handleAdd(type: PageSectionType) {
    setAdding(type);
    try {
      await addSection(type);
    } finally {
      setAdding(null);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col bg-[#0F172A] text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Blocks</p>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-3 py-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks…"
            className="flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto px-3 pb-2 scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              cat === c
                ? 'bg-[#F97316] text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-600">No blocks found</p>
        )}
        <div className="space-y-1">
          {filtered.map((block) => (
            <button
              key={block.type}
              type="button"
              disabled={adding === block.type}
              onClick={() => handleAdd(block.type)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50"
            >
              {/* Mini preview card */}
              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xl transition group-hover:bg-slate-700">
                {adding === block.type ? (
                  <span className="text-[10px] text-slate-400 animate-pulse">…</span>
                ) : (
                  block.icon
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-200">{block.label}</p>
                <p className="truncate text-[11px] text-slate-500">{block.desc}</p>
              </div>
              <div className="ml-auto shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded-lg bg-[#F97316]/20 px-2 py-0.5 text-[10px] font-bold text-[#F97316]">+</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
