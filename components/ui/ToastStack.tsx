'use client';

import { useRfqUiStore } from '@/lib/stores/rfq-ui-store';

export function ToastStack() {
  const { toasts, removeToast } = useRfqUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 end-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 backdrop-blur transition-all animate-in slide-in-from-bottom-2 ${
            t.kind === 'success'
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : t.kind === 'error'
              ? 'bg-red-50 text-red-800 ring-red-200'
              : 'bg-blue-50 text-blue-800 ring-blue-200'
          }`}
        >
          <span className="text-base leading-none">
            {t.kind === 'success' ? '✓' : t.kind === 'error' ? '✕' : 'ℹ'}
          </span>
          <span>{t.msg}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ms-1 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
