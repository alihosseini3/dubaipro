'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';

import { FormMessage, SubmitButton, TextArea, TextInput, Toggle } from './AdminForm';
import { DeleteButton } from './DeleteButton';
import { ImageUpload } from '@/components/ui/ImageUpload';
import type { AttributeDefinitionDTO, CategoryAttributeDTO, CategoryFilterConfigDTO } from '@/lib/attributes/service';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  icon: string | null;
  imageUrl: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  childCount: number;
};

type Props = {
  initialCategories: CategoryRow[];
  allAttributes?: AttributeDefinitionDTO[];
};

type DrawerTab = 'basic' | 'media' | 'seo' | 'filters' | 'attributes';

type EditForm = {
  id: string;
  name: string;
  slug: string;
  parentId: string;
  icon: string;
  imageUrl: string | null;
  description: string;
  metaTitle: string;
  metaDescription: string;
  sortOrder: number;
  isActive: boolean;
};

const FILTER_KEYS = [
  { key: 'showSearchFilter',      label: 'Search box' },
  { key: 'showPriceFilter',       label: 'Price filter' },
  { key: 'showRatingFilter',      label: 'Rating filter' },
  { key: 'showInStockFilter',     label: 'In-stock filter' },
  { key: 'showB2BFilter',         label: 'B2B/Wholesale filter' },
  { key: 'showDiscountFilter',    label: 'Deals filter' },
  { key: 'showNewArrivalsFilter', label: 'New Arrivals filter' },
  { key: 'showBrandFilter',       label: 'Brand filter' },
  { key: 'showSupplierFilter',    label: 'Supplier filter' },
] as const;

type FilterKey = (typeof FILTER_KEYS)[number]['key'];

const ICON_PRESETS = [
  '📦','🛍️','👗','👠','💄','📱','💻','🖥️','📷','🎮','🎵','📚','🏠','🛋️','🍳',
  '🍕','🚗','✈️','⚽','🏋️','🧴','💊','🔧','🌿','🧸','💍','⌚','🎁','🔑','🌟',
];

/* ─── Slugify helper ─────────────────────────────────────────────────────── */
function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ─── Icon Picker ────────────────────────────────────────────────────────── */

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(value.length > 2 ? '' : value);
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        Category Icon / Emoji
      </label>
      <div className="flex flex-wrap gap-1.5">
        {ICON_PRESETS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition ${
              value === emoji ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-slate-400'
            }`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange('')}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs text-slate-400 transition ${
            !value ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
          }`}
          title="No icon"
        >
          ✕
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Or type custom emoji / icon code…"
          value={custom}
          onChange={(e) => { setCustom(e.target.value); onChange(e.target.value); }}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
          maxLength={10}
        />
        {value && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-xl">
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Full Category Edit Drawer ──────────────────────────────────────────── */

function CategoryEditDrawer({
  cat,
  allCategories,
  allAttributes,
  onClose,
  onSaved,
}: {
  cat: CategoryRow;
  allCategories: CategoryRow[];
  allAttributes: AttributeDefinitionDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<DrawerTab>('basic');
  const [form, setForm] = useState<EditForm>({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    parentId: cat.parentId ?? '',
    icon: cat.icon ?? '',
    imageUrl: cat.imageUrl,
    description: cat.description ?? '',
    metaTitle: cat.metaTitle ?? '',
    metaDescription: cat.metaDescription ?? '',
    sortOrder: cat.sortOrder,
    isActive: cat.isActive,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  /* ─── filter / attribute state ─── */
  const [catAttrs, setCatAttrs] = useState<CategoryAttributeDTO[]>([]);
  const [filterCfg, setFilterCfg] = useState<CategoryFilterConfigDTO>({
    showPriceFilter: null, showBrandFilter: null, showSupplierFilter: null,
    showInStockFilter: null, showB2BFilter: null,
    showRatingFilter: null, showDiscountFilter: null,
    showNewArrivalsFilter: null, showSearchFilter: null,
  });
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [addingAttr, setAddingAttr] = useState('');

  const loadConfig = useCallback(async () => {
    const [attrRes, cfgRes] = await Promise.all([
      fetch(`/api/admin/categories/${cat.id}/attributes`),
      fetch(`/api/admin/categories/${cat.id}/filter-config`),
    ]);
    if (attrRes.ok) setCatAttrs((await attrRes.json()).data);
    if (cfgRes.ok) setFilterCfg((await cfgRes.json()).data);
    setCfgLoaded(true);
  }, [cat.id]);

  useEffect(() => {
    if (tab === 'filters' || tab === 'attributes') void loadConfig();
  }, [tab, loadConfig]);

  function upd<K extends keyof EditForm>(k: K, v: EditForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function autoSlug(name: string) {
    if (!form.slug || form.slug === slugify(cat.name)) upd('slug', slugify(name));
  }

  async function handleSave() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || slugify(form.name),
          parentId: form.parentId || null,
          icon: form.icon || null,
          imageUrl: form.imageUrl,
          description: form.description || null,
          metaTitle: form.metaTitle || null,
          metaDescription: form.metaDescription || null,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `status ${res.status}`);
      setMsg({ type: 'success', text: 'Saved successfully!' });
      onSaved();
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally { setSaving(false); }
  }

  async function saveFilterConfig() {
    setSavingCfg(true);
    const res = await fetch(`/api/admin/categories/${cat.id}/filter-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filterCfg),
    });
    if (res.ok) setMsg({ type: 'success', text: 'Filter config saved!' });
    setSavingCfg(false);
  }

  function cycleFilter(key: FilterKey) {
    setFilterCfg((prev) => {
      const cur = prev[key];
      return { ...prev, [key]: cur === null ? true : cur === true ? false : null };
    });
  }

  function filterLabel(v: boolean | null): { text: string; cls: string } {
    if (v === true)  return { text: 'Show',    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
    if (v === false) return { text: 'Hide',    cls: 'bg-red-50 text-red-700 ring-red-200' };
    return             { text: 'Inherit',  cls: 'bg-slate-100 text-slate-600 ring-slate-200' };
  }

  async function handleAddAttr() {
    if (!addingAttr) return;
    const res = await fetch(`/api/admin/categories/${cat.id}/attributes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributeId: addingAttr, isFilterable: true }),
    });
    if (res.ok) { setCatAttrs((await res.json()).data); setAddingAttr(''); }
  }

  async function handleRemoveAttr(attributeId: string) {
    const res = await fetch(`/api/admin/categories/${cat.id}/attributes`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributeId }),
    });
    if (res.ok) setCatAttrs((prev) => prev.filter((a) => a.attributeId !== attributeId));
  }

  async function handleToggleFilterable(attributeId: string, isFilterable: boolean) {
    const res = await fetch(`/api/admin/categories/${cat.id}/attributes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributeId, isFilterable }),
    });
    if (res.ok) setCatAttrs((await res.json()).data);
  }

  const assignedIds = new Set(catAttrs.map((a) => a.attributeId));
  const availableAttrs = allAttributes.filter((a) => !assignedIds.has(a.id));

  const TABS: { id: DrawerTab; label: string; icon: string }[] = [
    { id: 'basic',      label: 'Basic',      icon: '📝' },
    { id: 'media',      label: 'Media',      icon: '🖼️' },
    { id: 'seo',        label: 'SEO',        icon: '🔍' },
    { id: 'filters',    label: 'Filters',    icon: '⚙️' },
    { id: 'attributes', label: 'Attributes', icon: '🏷️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {form.icon && <span className="text-2xl">{form.icon}</span>}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900">{form.name || 'Untitled'}</h2>
              <p className="truncate text-xs text-slate-500">/{form.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || imgUploading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-200">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-semibold transition ${
                tab === t.id
                  ? 'border-b-2 border-indigo-600 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Message banner */}
        {msg && (
          <div className={`mx-5 mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {msg.text}
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Basic ── */}
          {tab === 'basic' && (
            <div className="space-y-4">
              <TextInput
                name="name" label="Category Name" required
                value={form.name}
                onChange={(e) => { upd('name', e.target.value); autoSlug(e.target.value); }}
              />
              <TextInput
                name="slug" label="Slug (URL)"
                value={form.slug}
                onChange={(e) => upd('slug', e.target.value)}
                hint="Auto-generated from name. Used in URLs."
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Parent Category
                </label>
                <select
                  value={form.parentId}
                  onChange={(e) => upd('parentId', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">— No parent (root category) —</option>
                  {allCategories.filter((c) => c.id !== cat.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parentId ? `  ↳ ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </div>
              <TextArea
                name="description" label="Short Description"
                value={form.description}
                onChange={(e) => upd('description', e.target.value)}
                rows={3}
                maxLength={500}
                hint={`${form.description.length}/500 characters`}
              />
              <IconPicker value={form.icon} onChange={(v) => upd('icon', v)} />
              <div className="grid grid-cols-2 gap-4">
                <TextInput
                  name="sortOrder" label="Sort Order" type="number"
                  value={form.sortOrder}
                  onChange={(e) => upd('sortOrder', Number(e.target.value))}
                  hint="Lower = shown first"
                />
                <div className="flex flex-col justify-end">
                  <Toggle
                    label="Active / Visible"
                    checked={form.isActive}
                    onChange={(v) => upd('isActive', v)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Media ── */}
          {tab === 'media' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Upload a banner or cover image for this category. Shown on the category page and in navigation.
              </p>
              <ImageUpload
                label="Category Image"
                value={form.imageUrl}
                onChange={(url) => upd('imageUrl', url)}
                onUploadingChange={setImgUploading}
                hint="Recommended: 1200×600px, WebP or JPEG"
              />
            </div>
          )}

          {/* ── SEO ── */}
          {tab === 'seo' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
                <strong>SEO Tips:</strong> Keep meta title under 60 chars and description under 160 chars for best results.
              </div>
              <TextInput
                name="metaTitle" label="Meta Title"
                value={form.metaTitle}
                onChange={(e) => upd('metaTitle', e.target.value)}
                maxLength={70}
                hint={`${form.metaTitle.length}/70 — Shown in Google search results`}
              />
              <TextArea
                name="metaDescription" label="Meta Description"
                value={form.metaDescription}
                onChange={(e) => upd('metaDescription', e.target.value)}
                rows={3}
                maxLength={200}
                hint={`${form.metaDescription.length}/200 — Snippet shown in search results`}
              />
              {/* Preview */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Google Preview</p>
                <p className="text-sm font-medium text-blue-700 underline">
                  {form.metaTitle || form.name || 'Category Name'}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  yourdomain.com/categories/{form.slug || cat.slug}
                </p>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                  {form.metaDescription || form.description || 'No description set yet.'}
                </p>
              </div>
            </div>
          )}

          {/* ── Filters ── */}
          {tab === 'filters' && (
            <div className="space-y-4">
              {!cfgLoaded ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">Loading…</div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    Override which filters appear on this category&apos;s storefront page.
                    <strong> Inherit</strong> uses the global setting.
                  </p>
                  <div className="space-y-2">
                    {FILTER_KEYS.map(({ key, label }) => {
                      const { text, cls } = filterLabel(filterCfg[key]);
                      return (
                        <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <span className="text-sm text-slate-700">{label}</span>
                          <button type="button" onClick={() => cycleFilter(key)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${cls}`}>
                            {text}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button type="button" onClick={saveFilterConfig} disabled={savingCfg}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                      {savingCfg ? 'Saving…' : 'Save Filter Config'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Attributes ── */}
          {tab === 'attributes' && (
            <div className="space-y-4">
              {!cfgLoaded ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">Loading…</div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    Attributes marked <strong>Filterable</strong> appear as filter panels on the storefront.
                  </p>
                  {catAttrs.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                      No attributes assigned yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {catAttrs.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-slate-800">{a.name}</span>
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{a.slug}</span>
                          </div>
                          <button type="button"
                            onClick={() => handleToggleFilterable(a.attributeId, !a.isFilterable)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                              a.isFilterable ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-slate-100 text-slate-600 ring-slate-200'
                            }`}>
                            {a.isFilterable ? 'Filterable' : 'Hidden'}
                          </button>
                          <button type="button" onClick={() => handleRemoveAttr(a.attributeId)}
                            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {availableAttrs.length > 0 && (
                    <div className="flex gap-2">
                      <select value={addingAttr} onChange={(e) => setAddingAttr(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none">
                        <option value="">Select attribute to add…</option>
                        {availableAttrs.map((a) => (
                          <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                        ))}
                      </select>
                      <button type="button" onClick={handleAddAttr} disabled={!addingAttr}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40">
                        Add
                      </button>
                    </div>
                  )}
                  {allAttributes.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No attributes defined yet.{' '}
                      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                      <a href="/admin/attributes" className="text-indigo-600 underline" rel="noopener">Create attributes first.</a>
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Create Category Modal ──────────────────────────────────────────────── */

function CreateCategoryModal({
  allCategories,
  onClose,
  onCreated,
}: {
  allCategories: CategoryRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [icon, setIcon] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(n: string) {
    setName(n);
    if (!slug || slug === slugify(name)) setSlug(slugify(n));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setPending(true); setError(null);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() || slugify(name), parentId: parentId || null, icon: icon || null }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `status ${res.status}`);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally { setPending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">New Category</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput name="name" label="Name" required value={name} onChange={(e) => handleNameChange(e.target.value)} />
          <TextInput name="slug" label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} hint="Auto-generated" />
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Parent Category</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none">
              <option value="">— Root category —</option>
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.parentId ? `  ↳ ${c.name}` : c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Icon (emoji)</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_PRESETS.slice(0, 15).map((emoji) => (
                <button key={emoji} type="button" onClick={() => setIcon(emoji === icon ? '' : emoji)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-base transition ${
                    icon === emoji ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-400'
                  }`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50">
              {pending ? 'Creating…' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Category Tree Node ─────────────────────────────────────────────────── */

function CategoryNode({
  cat,
  depth,
  children,
  onEdit,
  onToggleActive,
  onDeleted,
}: {
  cat: CategoryRow;
  depth: number;
  children?: React.ReactNode;
  onEdit: (cat: CategoryRow) => void;
  onToggleActive: (cat: CategoryRow) => void;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = cat.childCount > 0 || !!children;

  return (
    <div>
      <div
        className={`group flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 ${
          depth > 0 ? 'bg-slate-50/50' : 'bg-white'
        }`}
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition ${hasChildren ? 'hover:text-slate-700' : 'invisible'}`}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}>
            <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        {/* Icon */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-base shadow-sm">
          {cat.icon || '📁'}
        </span>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`truncate text-sm font-semibold ${cat.isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
              {cat.name}
            </span>
            {!cat.isActive && (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Hidden</span>
            )}
            {depth > 0 && (
              <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500">Sub</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>/{cat.slug}</span>
            {cat.productCount > 0 && <span>· {cat.productCount} products</span>}
            {cat.childCount > 0 && <span>· {cat.childCount} subcategories</span>}
            {cat.metaTitle && <span>· SEO ✓</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onToggleActive(cat)}
            title={cat.isActive ? 'Deactivate' : 'Activate'}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
              cat.isActive
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            {cat.isActive ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(cat)}
            className="rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            Edit
          </button>
          <DeleteButton endpoint={`/api/categories/${cat.id}`} compact onDeleted={onDeleted} />
        </div>
      </div>

      {/* Children */}
      {expanded && children && (
        <div className="border-l border-slate-200 ml-6">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Main CategoryManager ────────────────────────────────────────────────── */

export function CategoryManager({ initialCategories, allAttributes = [] }: Props) {
  const router = useRouter();
  const [cats, setCats] = useState<CategoryRow[]>(initialCategories);
  const [editCat, setEditCat] = useState<CategoryRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  function refresh() { router.refresh(); }

  async function toggleActive(cat: CategoryRow) {
    await fetch(`/api/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !cat.isActive }),
    });
    setCats((prev) => prev.map((c) => c.id === cat.id ? { ...c, isActive: !c.isActive } : c));
  }

  const filtered = search.trim()
    ? cats.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase()))
    : cats;

  const roots = filtered.filter((c) => !c.parentId);
  const childMap = new Map<string, CategoryRow[]>();
  filtered.forEach((c) => {
    if (c.parentId) {
      const arr = childMap.get(c.parentId) ?? [];
      arr.push(c);
      childMap.set(c.parentId, arr);
    }
  });

  function renderNode(cat: CategoryRow, depth: number): React.ReactNode {
    const children = childMap.get(cat.id);
    return (
      <CategoryNode
        key={cat.id}
        cat={cat}
        depth={depth}
        onEdit={setEditCat}
        onToggleActive={toggleActive}
        onDeleted={refresh}
      >
        {children?.map((child) => renderNode(child, depth + 1))}
      </CategoryNode>
    );
  }

  const total = cats.length;
  const active = cats.filter((c) => c.isActive).length;
  const rootCount = cats.filter((c) => !c.parentId).length;
  const subCount = cats.filter((c) => !!c.parentId).length;

  return (
    <>
      {editCat && (
        <CategoryEditDrawer
          cat={editCat}
          allCategories={cats}
          allAttributes={allAttributes}
          onClose={() => setEditCat(null)}
          onSaved={refresh}
        />
      )}
      {showCreate && (
        <CreateCategoryModal
          allCategories={cats}
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}

      <div className="space-y-5">
        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: total, color: 'text-slate-900' },
            { label: 'Active', value: active, color: 'text-emerald-600' },
            { label: 'Root', value: rootCount, color: 'text-indigo-600' },
            { label: 'Sub', value: subCount, color: 'text-violet-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
              <p className={`mt-0.5 text-2xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input
              type="text"
              placeholder="Search categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            New Category
          </button>
        </div>

        {/* Tree */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category Tree</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">{filtered.length}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-12 w-12 text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"/>
              </svg>
              <p className="text-sm font-medium">{search ? 'No results found' : 'No categories yet'}</p>
              {!search && (
                <button type="button" onClick={() => setShowCreate(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                  Create first category
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {roots.map((cat) => renderNode(cat, 0))}
              {/* Orphaned children (parent filtered out) */}
              {filtered.filter((c) => c.parentId && !cats.find((p) => p.id === c.parentId)).map((cat) => renderNode(cat, 0))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
