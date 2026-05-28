'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

const MediaPickerModal = dynamic(
  () => import('@/components/admin/media/MediaPickerModal').then((m) => ({ default: function MP(p: import('@/components/admin/media/MediaPickerModal').MediaPickerProps) { const C = m.MediaPickerModal; return <C {...p} />; } })),
  { ssr: false }
);

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100';

type Props = {
  label:       string;
  value:       string;
  onChange:    (url: string) => void;
  placeholder?: string;
};

export function ImageField({ label, value, onChange, placeholder = 'https://…' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          title="Pick from media library"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
            strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
          </svg>
        </button>
      </div>
      {value && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={value}
          alt="preview"
          className="mt-1 h-20 w-full rounded-lg border border-slate-200 object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
      )}
      {open && (
        <MediaPickerModal
          mode="single"
          onPick={(urls) => { onChange(urls[0] ?? ''); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </label>
  );
}
