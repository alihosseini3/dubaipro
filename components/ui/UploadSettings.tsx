'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type ImageOutputFormat = 'webp' | 'avif' | 'jpeg' | 'png';

export type UploadConfig = {
  format: ImageOutputFormat;
  quality: number;       // 30–100
  maxDimension: number;  // 0 = no limit
  stripMeta: boolean;
};

export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  format: 'webp',
  quality: 80,
  maxDimension: 1920,
  stripMeta: true,
};

const FORMAT_KEYS: { value: ImageOutputFormat; label: string; descKey: 'formatWebpDesc'|'formatAvifDesc'|'formatJpegDesc'|'formatPngDesc' }[] = [
  { value: 'webp', label: 'WebP', descKey: 'formatWebpDesc' },
  { value: 'avif', label: 'AVIF', descKey: 'formatAvifDesc' },
  { value: 'jpeg', label: 'JPEG', descKey: 'formatJpegDesc' },
  { value: 'png',  label: 'PNG',  descKey: 'formatPngDesc'  },
];

const DIM_VALUES = [640, 800, 1200, 1920, 2560, 3840, 0] as const;
const DIM_LABEL_KEYS = ['dimThumbnail','dimSmall','dimMedium','dimHD','dim2K','dim4K','dimOriginal'] as const;
type DimKey = typeof DIM_LABEL_KEYS[number];

const QUALITY_PRESET_KEYS: { q: number; key: 'qualityLow'|'qualityMed'|'qualityHigh' }[] = [
  { q: 65, key: 'qualityLow' },
  { q: 80, key: 'qualityMed' },
  { q: 90, key: 'qualityHigh' },
];

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

/* ─── Component ──────────────────────────────────────────────────────────── */

type Props = {
  value: UploadConfig;
  onChange: (v: UploadConfig) => void;
  /** Shows the panel always open (no toggle) */
  alwaysOpen?: boolean;
};

export function UploadSettings({ value, onChange, alwaysOpen = false }: Props) {
  const [open, setOpen] = useState(alwaysOpen);
  const t = useTranslations('uploadSettings');

  const set = <K extends keyof UploadConfig>(key: K, v: UploadConfig[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      {/* Toggle header */}
      {!alwaysOpen && (
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition">
          <span className="flex items-center gap-1.5">
            <Ic d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M18 22v-6M15 19h6M2 9h20" className="h-3.5 w-3.5 text-slate-400" />
            {t('title')}
            <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
              {value.format.toUpperCase()} · {value.quality}% · {value.maxDimension > 0 ? `${value.maxDimension}px` : t('dimOriginal').split(' — ')[0]}
            </span>
          </span>
          <Ic d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} className="h-3.5 w-3.5 text-slate-400" />
        </button>
      )}

      {(open || alwaysOpen) && (
        <div className="grid gap-4 p-3 pt-2 sm:grid-cols-2">

          {/* Format */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {t('format')}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {FORMAT_KEYS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => set('format', opt.value)}
                  title={t(opt.descKey)}
                  className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
                    value.format === opt.value
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}>
                  {opt.label}
                  <span className={`ml-1 text-[10px] font-normal ${value.format === opt.value ? 'text-indigo-500' : 'text-slate-400'}`}>
                    {t(opt.descKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quality + Dimension */}
          <div className="space-y-3">

            {/* Quality slider */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  {t('quality')}
                </label>
                <span className="flex items-center gap-1">
                  {QUALITY_PRESET_KEYS.map((p) => (
                    <button key={p.q} type="button"
                      onClick={() => set('quality', p.q)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                        value.quality === p.q ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}>
                      {t(p.key)}
                    </button>
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input type="range" min={30} max={100} step={1}
                  value={value.quality}
                  onChange={(e) => set('quality', Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600" />
                <span className="w-7 text-right text-xs font-bold tabular-nums text-slate-700">
                  {value.quality}
                </span>
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
                <span>{t('qualitySmall')}</span><span>{t('qualityBalanced')}</span><span>{t('qualitySharp')}</span>
              </div>
            </div>

            {/* Max dimension */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                {t('maxDimension')}
              </label>
              <select value={value.maxDimension}
                onChange={(e) => set('maxDimension', Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
                {DIM_VALUES.map((v, i) => (
                  <option key={v} value={v}>{t(DIM_LABEL_KEYS[i] as DimKey)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Strip EXIF — full width */}
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2">
              <div onClick={() => set('stripMeta', !value.stripMeta)}
                className={`relative h-4 w-7 rounded-full transition-colors ${value.stripMeta ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${value.stripMeta ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-slate-600">
                {t('stripMeta')}
                <span className="ml-1 text-slate-400">{t('stripMetaHint')}</span>
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
