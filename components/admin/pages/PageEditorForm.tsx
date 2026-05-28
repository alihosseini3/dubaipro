'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';

import { SeoPanel } from './SeoPanel';
import { SectionBlock } from './SectionBlock';
import { SectionConfigEditor } from './SectionEditors';
import type { PageDTO, PageSectionDTO, PageSeoDTO } from '@/lib/pages/service';
import type { PageSectionType, SectionConfig } from '@/lib/pages/types';
import { PAGE_SECTION_TYPES } from '@/lib/pages/types';

type Tab = 'content' | 'settings' | 'seo';

type Props = {
  initial: PageDTO;
  locale: string;
};

const RTL_LOCALES = ['fa', 'ar', 'ur'];

const SECTION_TYPE_LABELS: Record<PageSectionType, string> = {
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

export function PageEditorForm({ initial, locale }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<Tab>('content');

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle ?? '');
  const [metaDesc, setMetaDesc] = useState(initial.metaDescription ?? '');
  const [status, setStatus] = useState(initial.status);
  const [pageLocale, setPageLocale] = useState(initial.locale);

  const [sections, setSections] = useState<PageSectionDTO[]>(initial.sections);
  const [seo, setSeo] = useState<PageSeoDTO | null>(initial.seo);

  const [busy, setBusy] = useState(false);
  const [seoSaving, setSeoSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const initialSnapshot = useRef(JSON.stringify({
    title: initial.title,
    slug: initial.slug,
    metaTitle: initial.metaTitle,
    metaDesc: initial.metaDescription,
    status: initial.status,
    locale: initial.locale,
  }));

  useEffect(() => {
    const current = JSON.stringify({ title, slug, metaTitle, metaDesc, status, locale: pageLocale });
    setDirty(current !== initialSnapshot.current);
  }, [title, slug, metaTitle, metaDesc, status, pageLocale]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function savePageSettings() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pages/${initial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          metaTitle: metaTitle.trim() || null,
          metaDescription: metaDesc.trim() || null,
          status,
          locale: pageLocale,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'save_failed');
      }
      setDirty(false);
      initialSnapshot.current = JSON.stringify({ title, slug, metaTitle, metaDesc, status, locale: pageLocale });
      showToast('Page settings saved');
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save_failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveSeo(data: Partial<PageSeoDTO>) {
    setSeoSaving(true);
    try {
      const res = await fetch(`/api/admin/pages/${initial.id}/seo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('seo_save_failed');
      const json = await res.json();
      setSeo(json.data);
      showToast('SEO saved');
    } catch {
      setError('SEO save failed');
    } finally {
      setSeoSaving(false);
    }
  }

  async function addSection(type: PageSectionType) {
    try {
      const res = await fetch(`/api/admin/pages/${initial.id}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config: {}, isVisible: true }),
      });
      if (!res.ok) throw new Error('add_section_failed');
      const json = await res.json();
      setSections((prev) => [...prev, json.data as PageSectionDTO]);
      showToast(`${SECTION_TYPE_LABELS[type]} section added`);
    } catch {
      setError('Could not add section');
    }
  }

  const updateSectionConfig = useCallback(
    async (id: string, config: SectionConfig) => {
      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, config } : s))
      );
      try {
        await fetch(`/api/admin/pages/${initial.id}/sections/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config }),
        });
      } catch {
        setError('Section auto-save failed');
      }
    },
    [initial.id]
  );

  async function toggleSectionVisibility(section: PageSectionDTO) {
    const next = !section.isVisible;
    setSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, isVisible: next } : s))
    );
    await fetch(`/api/admin/pages/${initial.id}/sections/${section.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVisible: next }),
    }).catch(() => setError('Visibility update failed'));
  }

  async function deleteSection(id: string) {
    if (!confirm('Delete this section?')) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/admin/pages/${initial.id}/sections/${id}`, {
      method: 'DELETE',
    }).catch(() => setError('Delete failed'));
  }

  async function commitReorder(orderedIds: string[]) {
    await fetch(`/api/admin/pages/${initial.id}/sections/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: orderedIds }),
    }).catch(() => setError('Reorder failed'));
  }

  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

  return (
    <div className="space-y-0" dir={dir}>
      {/* ── Sticky Save Bar ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-6 -mt-6 mb-6 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur-sm lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold
              ${
                status === 'PUBLISHED'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {status === 'PUBLISHED' ? 'Published' : 'Draft'}
          </span>
          {dirty && (
            <span className="text-xs text-slate-400">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/${locale}/${initial.slug}`}
            target="_blank"
            rel="noopener"
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
          >
            View live ↗
          </a>
          <button
            type="button"
            onClick={savePageSettings}
            disabled={busy || !title.trim()}
            className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
          ✓ {toast}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {(['content', 'settings', 'seo'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition
              ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            {tab === 'content' ? 'Content' : tab === 'settings' ? 'Settings' : 'SEO'}
          </button>
        ))}
      </div>

      {/* ── Content Tab: Sections ───────────────────────────────────── */}
      {activeTab === 'content' && (
        <div className="space-y-3 pt-1">
          {sections.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
              <p className="text-sm text-slate-400">No sections yet.</p>
              <p className="mt-1 text-xs text-slate-400">
                Add your first section below.
              </p>
            </div>
          )}

          {sections.map((section) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => { dragId.current = section.id; }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragId.current && dragId.current !== section.id)
                  setOverId(section.id);
              }}
              onDragLeave={() => setOverId(null)}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragId.current;
                setOverId(null);
                dragId.current = null;
                if (!from || from === section.id) return;
                const next = sections.slice();
                const fromIdx = next.findIndex((s) => s.id === from);
                const toIdx = next.findIndex((s) => s.id === section.id);
                if (fromIdx < 0 || toIdx < 0) return;
                const [removed] = next.splice(fromIdx, 1);
                next.splice(toIdx, 0, removed);
                setSections(next);
                void commitReorder(next.map((s) => s.id));
              }}
            >
              <SectionBlock
                type={section.type}
                isVisible={section.isVisible}
                isOver={overId === section.id}
                onVisibilityToggle={() => toggleSectionVisibility(section)}
                onDelete={() => deleteSection(section.id)}
              >
                <SectionConfigEditor
                  type={section.type}
                  config={section.config}
                  onChange={(cfg) => updateSectionConfig(section.id, cfg)}
                  dir={dir}
                />
              </SectionBlock>
            </div>
          ))}

          {/* Add section picker */}
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Add section
            </p>
            <div className="flex flex-wrap gap-2">
              {PAGE_SECTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addSection(type)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                >
                  + {SECTION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Tab ────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </Field>
            <Field label="Slug" hint="Auto-syncs linked nav items on save">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                maxLength={96}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </Field>
            <Field label="Meta title (SEO)" hint="Leave empty to use page title">
              <input
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                maxLength={160}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </Field>
            <Field label="Meta description (SEO)">
              <input
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                maxLength={320}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </Field>
            <Field label="Locale" hint="Optional — empty = all locales">
              <select
                value={pageLocale}
                onChange={(e) => setPageLocale(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
              >
                <option value="">— All locales —</option>
                <option value="en">English</option>
                <option value="fa">فارسی</option>
                <option value="ar">العربية</option>
                <option value="ur">اردو</option>
              </select>
            </Field>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Public URL</p>
              <a
                href={`/${locale}/${slug || initial.slug}`}
                target="_blank"
                rel="noopener"
                className="text-xs text-orange-600 hover:underline"
              >
                /{locale}/{slug || initial.slug}
              </a>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold
                ${
                  status === 'PUBLISHED'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
            >
              {status === 'PUBLISHED' ? '✓ Live' : 'Draft'}
            </span>
          </div>
        </div>
      )}

      {/* ── SEO Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'seo' && (
        <SeoPanel
          page={{
            ...initial,
            title,
            metaTitle: metaTitle || null,
            metaDescription: metaDesc || null,
            slug,
          }}
          seo={seo}
          onSave={saveSeo}
          saving={seoSaving}
        />
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px] text-slate-400">{hint}</span>
      )}
    </label>
  );
}
