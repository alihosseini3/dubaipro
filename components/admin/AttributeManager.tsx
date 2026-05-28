'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { AttributeDefinitionDTO, AttributeType } from '@/lib/attributes/service';

type Props = { attributes: AttributeDefinitionDTO[] };

const ALL_TYPES: AttributeType[] = ['select', 'number', 'boolean', 'color'];

const TYPE_COLORS: Record<AttributeType, string> = {
  select:  'bg-orange-50 text-orange-700 ring-orange-200',
  number:  'bg-amber-50 text-amber-700 ring-amber-200',
  boolean: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  color:   'bg-pink-50 text-pink-700 ring-pink-200',
};

const LOCALES = ['en', 'fa', 'ar', 'ur'] as const;

type FormState = {
  name: string;
  slug: string;
  type: AttributeType;
  unit: string;
  options: string;
  group: string;
  nameTranslations: Record<string, string>;
};

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  type: 'select',
  unit: '',
  options: '',
  group: '',
  nameTranslations: { en: '', fa: '', ar: '', ur: '' },
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function AttributeManager({ attributes: initial }: Props) {
  const router = useRouter();
  const t = useTranslations('admin.attributes');
  const tCommon = useTranslations('admin.common');

  const [attributes, setAttributes] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  const [nameLang, setNameLang] = useState<typeof LOCALES[number]>('en');

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
    setError('');
    setNameLang('en');
  }

  function openEdit(attr: AttributeDefinitionDTO) {
    setForm({
      name: attr.name,
      slug: attr.slug,
      type: attr.type,
      unit: attr.unit ?? '',
      options: attr.options ? attr.options.join('\n') : '',
      group: attr.group ?? '',
      nameTranslations: {
        en: attr.nameTranslations?.en ?? attr.name,
        fa: attr.nameTranslations?.fa ?? '',
        ar: attr.nameTranslations?.ar ?? '',
        ur: attr.nameTranslations?.ur ?? '',
      },
    });
    setEditing(attr.id);
    setCreating(false);
    setError('');
    setNameLang('en');
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setError('');
  }

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: editing ? f.slug : slugify(name),
      nameTranslations: { ...f.nameTranslations, [nameLang]: name },
    }));
  }

  function handleTranslationChange(lang: string, val: string) {
    setForm((f) => ({
      ...f,
      nameTranslations: { ...f.nameTranslations, [lang]: val },
      ...(lang === 'en' ? { name: val, slug: editing ? f.slug : slugify(val) } : {}),
    }));
  }

  async function handleSave() {
    const defaultName = form.nameTranslations.en || form.name;
    if (!defaultName.trim() || !form.slug.trim()) {
      setError(tCommon('validationError'));
      return;
    }
    setPending(true);
    setError('');
    try {
      const options = form.type === 'select'
        ? form.options.split('\n').map((o) => o.trim()).filter(Boolean)
        : [];

      const nonEmptyTranslations = Object.fromEntries(
        Object.entries(form.nameTranslations).filter(([, v]) => v.trim() !== '')
      );

      const body: Record<string, unknown> = {
        name: defaultName.trim(),
        slug: form.slug.trim(),
        type: form.type,
        unit: form.unit.trim() || undefined,
        options: form.type === 'select' ? options : undefined,
        group: form.group.trim() || undefined,
        nameTranslations: Object.keys(nonEmptyTranslations).length > 0
          ? nonEmptyTranslations
          : undefined,
      };

      const url = editing ? `/api/admin/attributes/${editing}` : '/api/admin/attributes';
      const method = editing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { data?: AttributeDefinitionDTO; error?: string };
      if (!res.ok) { setError(json.error ?? tCommon('saveFailed')); return; }

      if (editing) {
        setAttributes((prev) => prev.map((a) => a.id === editing ? { ...a, ...json.data } : a));
      } else {
        setAttributes((prev) => [...prev, json.data!]);
      }
      closeForm();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(tCommon('deleteConfirm'))) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/attributes/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert(tCommon('deleteFailed')); return; }
      setAttributes((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  async function handleReorder(id: string, direction: 'up' | 'down') {
    const idx = attributes.findIndex((a) => a.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === attributes.length - 1) return;

    setReordering(id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const current = attributes[idx];
    const target = attributes[targetIdx];

    try {
      await Promise.all([
        fetch(`/api/admin/attributes/${current.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: target.sortOrder }),
        }),
        fetch(`/api/admin/attributes/${target.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: current.sortOrder }),
        }),
      ]);

      setAttributes((prev) => {
        const next = [...prev];
        const a = { ...next[idx], sortOrder: target.sortOrder };
        const b = { ...next[targetIdx], sortOrder: current.sortOrder };
        next[idx] = b;
        next[targetIdx] = a;
        return next;
      });
      router.refresh();
    } finally {
      setReordering(null);
    }
  }

  const showForm = creating || editing !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {attributes.length} {attributes.length !== 1 ? t('title').toLowerCase() : t('title').toLowerCase().replace(/s$/, '')}
          </h2>
          <p className="text-xs text-slate-500">{t('subtitle')}</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
              <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
            </svg>
            {t('new')}
          </button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">
            {editing ? t('edit') : t('new')}
          </h3>

          {/* Multi-lang name tabs */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-slate-700">
              {t('fieldNameTranslations')}
            </label>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit mb-2">
              {LOCALES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setNameLang(lang)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    nameLang === lang
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={form.nameTranslations[nameLang] ?? ''}
              onChange={(e) => handleTranslationChange(nameLang, e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              placeholder={`${t('fieldName')} (${nameLang.toUpperCase()})`}
              dir={['fa', 'ar', 'ur'].includes(nameLang) ? 'rtl' : 'ltr'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Slug */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('fieldSlug')} *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="e.g. size, color, processor"
              />
              <p className="mt-0.5 text-xs text-slate-400">{t('fieldSlugHint')}</p>
            </div>

            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('fieldType')} *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AttributeType }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                {ALL_TYPES.map((v) => (
                  <option key={v} value={v}>{t(`type${v.charAt(0).toUpperCase() + v.slice(1)}` as 'typeSelect' | 'typeNumber' | 'typeBoolean' | 'typeColor')}</option>
                ))}
              </select>
            </div>

            {/* Unit (number only) */}
            {form.type === 'number' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">{t('fieldUnit')}</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="e.g. GHz, kg, cm"
                />
                <p className="mt-0.5 text-xs text-slate-400">{t('fieldUnitHint')}</p>
              </div>
            )}

            {/* Group */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">{t('fieldGroup')}</label>
              <input
                type="text"
                value={form.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="e.g. Appearance, Specifications"
              />
              <p className="mt-0.5 text-xs text-slate-400">{t('fieldGroupHint')}</p>
            </div>

            {/* Options (select or color only) */}
            {(form.type === 'select' || form.type === 'color') && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {t('fieldOptions')}
                </label>
                {form.type === 'color' && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {form.options.split('\n').map((o) => o.trim()).filter(Boolean).map((c) => (
                      <div
                        key={c}
                        className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5"
                      >
                        <span
                          className="h-3 w-3 rounded-full border border-slate-300"
                          style={{ backgroundColor: c.startsWith('#') || c.startsWith('rgb') ? c : undefined }}
                        />
                        <span className="text-xs text-slate-700">{c}</span>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  value={form.options}
                  onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder={form.type === 'color' ? '#FF0000\n#00FF00\n#0000FF' : 'S\nM\nL\nXL\nXXL'}
                />
                <p className="mt-1 text-xs text-slate-400">{t('fieldOptionsHint')}</p>
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
            >
              {pending ? tCommon('saving') : editing ? tCommon('update') : tCommon('create')}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {attributes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
          {t('empty')}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {attributes.map((attr, idx) => (
            <div key={attr.id} className="flex items-center gap-3 px-4 py-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => handleReorder(attr.id, 'up')}
                  disabled={idx === 0 || reordering === attr.id}
                  aria-label={t('moveUp')}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path d="M8 4l4 5H4l4-5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleReorder(attr.id, 'down')}
                  disabled={idx === attributes.length - 1 || reordering === attr.id}
                  aria-label={t('moveDown')}
                  className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path d="M8 12l-4-5h8l-4 5z" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{attr.name}</span>
                  {attr.nameTranslations && Object.entries(attr.nameTranslations).filter(([k, v]) => k !== 'en' && v).map(([lang, val]) => (
                    <span key={lang} className="text-xs text-slate-400">
                      {lang.toUpperCase()}: {val as string}
                    </span>
                  ))}
                  <span className="font-mono text-xs text-slate-400">{attr.slug}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${TYPE_COLORS[attr.type]}`}>
                    {t(`type${attr.type.charAt(0).toUpperCase() + attr.type.slice(1)}` as 'typeSelect' | 'typeNumber' | 'typeBoolean' | 'typeColor')}
                  </span>
                  {attr.group && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                      {attr.group}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  {attr.unit && <span>{t('fieldUnit')}: {attr.unit}</span>}
                  {(attr.type === 'select' || attr.type === 'color') && attr.options && (
                    <span>{attr.options.length} options: {attr.options.slice(0, 4).join(', ')}{attr.options.length > 4 ? '…' : ''}</span>
                  )}
                  <span>{attr.categoryCount} {t('headerCategories').toLowerCase()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openEdit(attr)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                {tCommon('edit')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(attr.id)}
                disabled={deleting === attr.id}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {deleting === attr.id ? tCommon('working') : tCommon('delete')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
