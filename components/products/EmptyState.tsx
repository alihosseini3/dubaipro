type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <svg
        viewBox="0 0 64 64"
        className="mb-3 h-12 w-12 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="10" y="18" width="44" height="34" rx="3" />
        <path d="M22 18v-4a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v4" />
        <path d="M10 32h44" />
      </svg>
      <p className="text-base font-medium text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}
