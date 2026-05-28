'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

type UsersFiltersProps = {
  locale: string;
};

const ROLES = ['ALL', 'ADMIN', 'CUSTOMER', 'SELLER', 'SUPPLIER'] as const;

/**
 * URL-backed filter toolbar for the users list.
 *
 * - `q` → full-text match on name/email (debounced).
 * - `role` → exact match on UserRole.
 *
 * Writing back to the URL keeps the filters shareable/bookmarkable and
 * lets the parent server component re-query on each change.
 */
export function UsersFilters({ locale }: UsersFiltersProps) {
  const t = useTranslations('admin.users');
  const tRole = useTranslations('auth.role');
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const currentRole = (params.get('role') ?? 'ALL').toUpperCase();
  const currentQuery = params.get('q') ?? '';

  const [query, setQuery] = useState(currentQuery);

  // Keep local state in sync when the URL changes (e.g. back/forward nav).
  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  function buildUrl(nextRole: string, nextQuery: string): string {
    const usp = new URLSearchParams();
    if (nextRole && nextRole !== 'ALL') usp.set('role', nextRole);
    if (nextQuery.trim()) usp.set('q', nextQuery.trim());
    const qs = usp.toString();
    return `/${locale}/admin/users${qs ? `?${qs}` : ''}`;
  }

  function commit(nextRole: string, nextQuery: string) {
    startTransition(() => {
      router.replace(buildUrl(nextRole, nextQuery));
    });
  }

  // Debounce the search so every keystroke doesn't refetch.
  useEffect(() => {
    if (query === currentQuery) return;
    const handle = window.setTimeout(() => commit(currentRole, query), 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[260px] flex-1">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-9 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ROLES.map((r) => {
          const isActive = currentRole === r;
          const label =
            r === 'ALL' ? t('filterAllRoles') : tRole(r.toLowerCase() as Lowercase<typeof r>);
          return (
            <button
              key={r}
              type="button"
              onClick={() => commit(r, query)}
              className={
                'rounded-full px-3 py-1 text-xs font-semibold transition ' +
                (isActive
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100')
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
