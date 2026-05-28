'use client';

import { useBuilder } from './BuilderContext';

export function ToastStack() {
  const { state } = useBuilder();
  const { toasts } = state;

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-sm transition-all duration-300 ${
            t.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : t.type === 'info'
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span className="text-base">
            {t.type === 'error' ? '✗' : t.type === 'info' ? 'ℹ' : '✓'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
