'use client';

import { useTranslations } from 'next-intl';

export type UploadQueueItem = {
  name: string;
  done: boolean;
  error?: string;
  label?: string;
};

type Props = { queue: UploadQueueItem[] };

export function UploadProgress({ queue }: Props) {
  const t = useTranslations('admin.gallery');
  if (queue.length === 0) return null;

  const doneCount  = queue.filter((q) => q.done).length;
  const errorCount = queue.filter((q) => q.error).length;
  const pending    = queue.filter((q) => !q.done && !q.error).length;

  return (
    <div className="border-b border-orange-200 bg-orange-50 px-4 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-orange-700">
          {t('uploading', { n: queue.length })}
        </p>
        <p className="text-[11px] text-orange-500">
          {doneCount}/{queue.length}
          {errorCount > 0 && <span className="ms-1.5 text-red-500">{errorCount} failed</span>}
        </p>
      </div>
      {/* overall progress bar */}
      <div className="mb-2 h-1 overflow-hidden rounded-full bg-orange-200">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-300"
          style={{ width: `${queue.length ? (doneCount / queue.length) * 100 : 0}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {queue.map((q, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
              q.error  ? 'bg-red-100 text-red-700'
              : q.done ? 'bg-emerald-100 text-emerald-700'
              : 'bg-orange-100 text-orange-700'
            }`}
          >
            {q.error ? '✕' : q.done ? '✓' : (
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
            )}
            <span className="max-w-[120px] truncate">{q.name}</span>
            {q.label && <span className="text-[10px] opacity-70">{q.label}</span>}
          </span>
        ))}
      </div>
      {pending > 0 && (
        <p className="mt-1 text-[10px] text-orange-400">{pending} pending…</p>
      )}
    </div>
  );
}
