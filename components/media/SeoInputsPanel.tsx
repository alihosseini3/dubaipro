'use client';

/**
 * SeoInputsPanel — controlled form panel for image SEO & accessibility.
 *
 * Captures: alt (required), title, seoTitle, caption, description and a
 * keywords chip list. Pure presentational component — the parent owns
 * the state and decides when to persist.
 *
 * Designed to be embedded inside <SmartMediaUploader /> (during
 * preparing/upload) AND inside the gallery edit drawer (post-upload).
 */

import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

export interface SeoInputsValue {
  alt: string;
  title: string;
  seoTitle: string;
  caption: string;
  description: string;
  keywords: string[];
}

export const EMPTY_SEO_INPUTS: SeoInputsValue = {
  alt: '',
  title: '',
  seoTitle: '',
  caption: '',
  description: '',
  keywords: [],
};

const LIMITS = {
  alt: 160,
  title: 120,
  seoTitle: 160,
  caption: 500,
  description: 500,
} as const;

const MAX_KEYWORDS = 20;

interface Props {
  value: SeoInputsValue;
  onChange: (value: SeoInputsValue) => void;
  /** Auto-generated alt suggestion offered with a "use" button. */
  altSuggestion?: string;
  /** Force a single-column layout (used inside narrow panels). */
  dense?: boolean;
  /** Show validation hint when alt is empty. Default: true. */
  requireAlt?: boolean;
  className?: string;
}

export function SeoInputsPanel({
  value,
  onChange,
  altSuggestion,
  dense = false,
  requireAlt = true,
  className,
}: Props) {
  const t = useTranslations('media.seo');

  const set = <K extends keyof SeoInputsValue>(key: K, v: SeoInputsValue[K]) =>
    onChange({ ...value, [key]: v });

  const altMissing = requireAlt && value.alt.trim().length === 0;

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <Field
        label={t('altLabel')}
        required
        hint={altMissing ? undefined : t('altHint')}
        warning={altMissing ? t('altMissing') : undefined}
      >
        <Counter v={value.alt.length} max={LIMITS.alt}>
          <textarea
            value={value.alt}
            onChange={(e) => set('alt', e.target.value.slice(0, LIMITS.alt))}
            placeholder={altSuggestion || t('altPlaceholder')}
            rows={2}
            className={inputClass(altMissing)}
          />
        </Counter>
        {altSuggestion && value.alt.trim().length === 0 && (
          <button
            type="button"
            onClick={() => set('alt', altSuggestion)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            <span>✨</span>
            {t('useSuggestion')}
          </button>
        )}
      </Field>

      <div className={dense ? 'space-y-3' : 'grid gap-3 sm:grid-cols-2'}>
        <Field label={t('titleLabel')} hint={t('titleHint')}>
          <Counter v={value.title.length} max={LIMITS.title}>
            <input
              value={value.title}
              onChange={(e) => set('title', e.target.value.slice(0, LIMITS.title))}
              placeholder={t('titlePlaceholder')}
              className={inputClass()}
            />
          </Counter>
        </Field>

        <Field label={t('seoTitleLabel')} hint={t('seoTitleHint')}>
          <Counter v={value.seoTitle.length} max={LIMITS.seoTitle}>
            <input
              value={value.seoTitle}
              onChange={(e) => set('seoTitle', e.target.value.slice(0, LIMITS.seoTitle))}
              placeholder={t('seoTitlePlaceholder')}
              className={inputClass()}
            />
          </Counter>
        </Field>
      </div>

      <Field label={t('captionLabel')}>
        <Counter v={value.caption.length} max={LIMITS.caption}>
          <input
            value={value.caption}
            onChange={(e) => set('caption', e.target.value.slice(0, LIMITS.caption))}
            placeholder={t('captionPlaceholder')}
            className={inputClass()}
          />
        </Counter>
      </Field>

      <Field label={t('descriptionLabel')} hint={t('descriptionHint')}>
        <Counter v={value.description.length} max={LIMITS.description}>
          <textarea
            value={value.description}
            onChange={(e) => set('description', e.target.value.slice(0, LIMITS.description))}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
            className={inputClass()}
          />
        </Counter>
      </Field>

      <Field label={t('keywordsLabel')} hint={t('keywordsHint')}>
        <KeywordsInput
          value={value.keywords}
          onChange={(kw) => set('keywords', kw)}
          placeholder={t('keywordsPlaceholder')}
        />
      </Field>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function KeywordsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (value.includes(v)) {
      setDraft('');
      return;
    }
    if (value.length >= MAX_KEYWORDS) {
      setDraft('');
      return;
    }
    onChange([...value, v]);
    setDraft('');
  };

  const remove = (k: string) => onChange(value.filter((x) => x !== k));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200">
      {value.map((k) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700"
        >
          {k}
          <button
            type="button"
            onClick={() => remove(k)}
            className="text-indigo-500 transition hover:text-indigo-900"
            aria-label={`remove ${k}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-[120px] flex-1 border-0 bg-transparent text-xs text-slate-700 outline-none"
      />
      <span className="text-[10px] tabular-nums text-slate-400">
        {value.length}/{MAX_KEYWORDS}
      </span>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  warning,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  warning?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-0.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        <span>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </label>
      {children}
      {warning && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-700">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
            aria-hidden
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
          </svg>
          {warning}
        </p>
      )}
      {!warning && hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Counter({
  v,
  max,
  children,
}: {
  v: number;
  max: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <span
        className={`pointer-events-none absolute bottom-1 right-2 text-[10px] tabular-nums ${
          v > max * 0.95 ? 'font-semibold text-amber-600' : 'text-slate-400'
        }`}
      >
        {v}/{max}
      </span>
    </div>
  );
}

function inputClass(invalid = false): string {
  return [
    'w-full rounded-lg border bg-white px-2.5 py-1.5 pe-12 text-xs text-slate-700 outline-none transition',
    'focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200',
    invalid ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200',
  ].join(' ');
}
