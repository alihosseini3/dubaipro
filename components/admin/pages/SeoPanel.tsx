'use client';

import { useState } from 'react';

import type { PageDTO, PageSeoDTO } from '@/lib/pages/service';
import { MediaPickerModal } from '@/components/admin/media/MediaPickerModal';

type Props = {
  page: PageDTO;
  seo: PageSeoDTO | null;
  onSave: (seo: Partial<PageSeoDTO>) => void;
  saving?: boolean;
};

const ROBOTS_OPTIONS = [
  { value: 'index,follow', label: 'index, follow (default)' },
  { value: 'noindex,follow', label: 'noindex, follow' },
  { value: 'index,nofollow', label: 'index, nofollow' },
  { value: 'noindex,nofollow', label: 'noindex, nofollow' },
];

export function SeoPanel({ page, seo, onSave, saving }: Props) {
  const [ogImage, setOgImage] = useState(seo?.ogImage ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [canonicalUrl, setCanonicalUrl] = useState(seo?.canonicalUrl ?? '');
  const [robots, setRobots] = useState(seo?.robots ?? 'index,follow');
  const [structuredData, setStructuredData] = useState(
    seo?.structuredData ? JSON.stringify(seo.structuredData, null, 2) : ''
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const metaTitle = page.metaTitle || page.title;
  const metaDesc = page.metaDescription || page.title;
  const titleLen = metaTitle.length;
  const descLen = metaDesc.length;

  function handleSave() {
    let sd: Record<string, unknown> | null = null;
    if (structuredData.trim()) {
      try {
        sd = JSON.parse(structuredData);
        setJsonError(null);
      } catch {
        setJsonError('Invalid JSON');
        return;
      }
    }
    onSave({
      ogImage: ogImage.trim() || null,
      canonicalUrl: canonicalUrl.trim() || null,
      robots: robots || null,
      structuredData: sd,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          SEO Preview
        </h3>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-[11px] text-green-700 truncate">
            {typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/{page.slug}
          </div>
          <div
            className={`text-lg font-medium leading-tight text-blue-700 truncate ${titleLen > 60 ? 'text-amber-600' : ''}`}
          >
            {metaTitle}
          </div>
          <div
            className={`mt-1 text-sm text-slate-600 line-clamp-2 ${descLen > 160 ? 'text-amber-600' : ''}`}
          >
            {metaDesc}
          </div>
        </div>
        <div className="mt-3 flex gap-6 text-xs text-slate-500">
          <span className={titleLen > 60 ? 'text-amber-600 font-medium' : ''}>
            Title: {titleLen}/60 chars
          </span>
          <span className={descLen > 160 ? 'text-amber-600 font-medium' : ''}>
            Desc: {descLen}/160 chars
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Open Graph
        </h3>
        <Field label="OG Image URL" hint="Recommended: 1200×630px">
          <div className="flex gap-2">
            <input
              value={ogImage}
              onChange={(e) => setOgImage(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
            />
            <button type="button" onClick={() => setPickerOpen(true)}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-orange-400 hover:text-orange-600">
              Browse
            </button>
          </div>
        </Field>
        {pickerOpen && (
          <MediaPickerModal
            mode="single"
            onPick={(urls) => { if (urls[0]) setOgImage(urls[0]); }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {ogImage && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="aspect-[1200/630] w-full bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ogImage}
                alt="OG preview"
                className="h-full w-full object-cover"
                onError={(e) =>
                  ((e.target as HTMLImageElement).style.display = 'none')
                }
              />
            </div>
            <div className="border-t border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-700 truncate">{metaTitle}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 truncate">{metaDesc}</p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Advanced
        </h3>

        <Field label="Canonical URL" hint="Leave empty to use the page URL">
          <input
            value={canonicalUrl}
            onChange={(e) => setCanonicalUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
          />
        </Field>

        <Field label="Robots">
          <select
            value={robots}
            onChange={(e) => setRobots(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100"
          >
            {ROBOTS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="JSON-LD Structured Data"
          hint="Must be valid JSON (e.g. Article, FAQPage, BreadcrumbList)"
        >
          <textarea
            value={structuredData}
            onChange={(e) => {
              setStructuredData(e.target.value);
              setJsonError(null);
            }}
            rows={6}
            placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Article"\n}'}
            className={`w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-orange-100
              ${jsonError ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 focus:border-orange-400 focus:bg-white'}`}
          />
          {jsonError && (
            <p className="mt-1 text-xs text-red-600">{jsonError}</p>
          )}
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save SEO settings'}
        </button>
      </div>
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
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}
