'use client';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
      {error.digest && <p className="text-xs text-slate-400">ID: {error.digest}</p>}
      <button
        onClick={reset}
        className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Try again
      </button>
    </div>
  );
}
