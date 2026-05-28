'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from 'react';

import type {
  BrandSuggestion,
  CategorySuggestion,
  ProductSuggestion,
  SearchSuggestionsResponse
} from '@/lib/search/service';

type Category = { id: string; name: string; slug: string };

type Props = {
  locale: string;
  categories: Category[];
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  hideMobileTrigger?: boolean;
  labels: {
    placeholder: string;
    allCategories: string;
    button: string;
    open: string;
    close: string;
    /** "No matches" line. Optional, falls back to a hardcoded English. */
    noResults?: string;
    /** "Categories" group heading. */
    categoriesHeading?: string;
    /** "Brands" group heading. */
    brandsHeading?: string;
    /** "Products" group heading. */
    productsHeading?: string;
    /** Footer CTA "Search for '<q>'". */
    seeAll?: string;
  };
};

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

/**
 * Header search with live suggestions.
 *
 *  - Debounced fetch (300ms) against `/api/search?q=`.
 *  - Combined dropdown listing products (with image + price + category
 *    breadcrumb), brands and categories.
 *  - Full keyboard support: ↑/↓ moves the highlight, Enter activates,
 *    Esc closes.
 *  - Click-outside closes via a single document mousedown listener.
 *  - Submitting the form (or activating the "See all" footer) pushes
 *    to `/{locale}/products?q=…&category=…`.
 *
 * The dropdown items are merged into a single flat array (`flatItems`)
 * so keyboard navigation just walks `selectedIndex` between -1 and
 * `flatItems.length - 1`. -1 means "no item selected → submit pushes
 * to the products listing".
 */
export function SearchBar({
  locale,
  categories,
  mobileOpen: controlledMobileOpen,
  onMobileOpenChange,
  hideMobileTrigger = false,
  labels
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchSuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // AbortController for the in-flight request — lets later keystrokes
  // cancel earlier ones so results never arrive out of order.
  const abortRef = useRef<AbortController | null>(null);
  const mobileOpen = controlledMobileOpen ?? internalMobileOpen;

  function setMobileOpen(next: boolean) {
    if (controlledMobileOpen === undefined) {
      setInternalMobileOpen(next);
    }
    onMobileOpenChange?.(next);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    setOpen(true);
  }, [mobileOpen]);

  /* -------------------- Debounced fetch -------------------- */
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ac.signal }
        );
        if (!res.ok) throw new Error('search_failed');
        const json = (await res.json()) as SearchSuggestionsResponse;
        setData(json);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setData(null);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  /* -------------------- Click-outside close -------------------- */
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /* -------------------- Flatten suggestions -------------------- */
  const flatItems = useMemo(() => {
    if (!data) return [] as FlatItem[];
    const out: FlatItem[] = [];
    for (const p of data.products) out.push({ kind: 'product', item: p });
    for (const c of data.categories) out.push({ kind: 'category', item: c });
    for (const b of data.brands) out.push({ kind: 'brand', item: b });
    return out;
  }, [data]);

  // Reset highlight whenever the suggestion list changes.
  useEffect(() => setSelectedIndex(-1), [flatItems]);

  function activateItem(it: FlatItem) {
    setOpen(false);
    setMobileOpen(false);
    if (it.kind === 'product') {
      router.push(`/${locale}/products/${it.item.slug}`);
    } else if (it.kind === 'category') {
      router.push(`/${locale}/products?category=${encodeURIComponent(it.item.slug)}`);
    } else {
      // No dedicated brand page — link into the products listing.
      router.push(`/${locale}/products?q=${encodeURIComponent(it.item.name)}`);
    }
  }

  function pushAll(q: string) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    const qs = params.toString();
    router.push(`/${locale}/products${qs ? `?${qs}` : ''}`);
    setOpen(false);
    setMobileOpen(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (selectedIndex >= 0 && flatItems[selectedIndex]) {
      activateItem(flatItems[selectedIndex]);
      return;
    }
    pushAll(trimmed);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || flatItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(flatItems.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(-1, i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const trimmedQ = query.trim();
  const showDropdown =
    open &&
    trimmedQ.length >= MIN_QUERY &&
    (loading || data !== null);

  return (
    <div ref={containerRef} className="relative w-full max-w-4xl">
      {/* Mobile-only icon trigger. Hidden once the panel is open. */}
      {!hideMobileTrigger && !mobileOpen && (
        <button
          type="button"
          aria-label={labels.open}
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-11 w-11 min-h-[44px] items-center justify-center rounded-xl text-white transition hover:bg-white/10 md:hidden"
        >
          <SearchIcon className="h-5 w-5" />
        </button>
      )}

      <form
        onSubmit={onSubmit}
        className={`${
          mobileOpen ? 'flex' : 'hidden'
        } md:flex w-full items-stretch overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200/40 transition-all duration-200 focus-within:shadow-lg focus-within:ring-2 focus-within:ring-orange-400`}
        role="search"
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
      >
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="hidden min-h-[52px] max-w-[180px] cursor-pointer appearance-none border-e border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 sm:block"
          aria-label={labels.allCategories}
        >
          <option value="">{labels.allCategories}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={labels.placeholder}
          // Disable the browser's native dropdown so it doesn't fight
          // ours. role+aria below keeps screen-reader semantics correct.
          autoComplete="off"
          spellCheck={false}
          className="min-h-[52px] min-w-0 flex-1 px-5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          aria-label={labels.placeholder}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-activedescendant={
            selectedIndex >= 0 ? `search-opt-${selectedIndex}` : undefined
          }
        />
        {mobileOpen && (
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => {
              setMobileOpen(false);
              setOpen(false);
            }}
            className="inline-flex min-h-[52px] items-center px-3 text-slate-400 transition hover:text-slate-700 md:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        )}
        <button
          type="submit"
          className="inline-flex min-h-[52px] items-center gap-2 bg-orange-500 px-6 text-sm font-bold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.08)] transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        >
          <SearchIcon className="h-5 w-5" />
          <span className="hidden sm:inline">{labels.button}</span>
        </button>
      </form>

      {showDropdown && (
        <SuggestionsPanel
          query={trimmedQ}
          locale={locale}
          loading={loading}
          data={data}
          flatItems={flatItems}
          selectedIndex={selectedIndex}
          onHover={setSelectedIndex}
          onSelect={activateItem}
          onSeeAll={() => pushAll(trimmedQ)}
          labels={labels}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Suggestion list                                                            */
/* -------------------------------------------------------------------------- */

type FlatItem =
  | { kind: 'product'; item: ProductSuggestion }
  | { kind: 'category'; item: CategorySuggestion }
  | { kind: 'brand'; item: BrandSuggestion };

function SuggestionsPanel({
  query,
  locale,
  loading,
  data,
  flatItems,
  selectedIndex,
  onHover,
  onSelect,
  onSeeAll,
  labels
}: {
  query: string;
  locale: string;
  loading: boolean;
  data: SearchSuggestionsResponse | null;
  flatItems: FlatItem[];
  selectedIndex: number;
  onHover: (idx: number) => void;
  onSelect: (it: FlatItem) => void;
  onSeeAll: () => void;
  labels: Props['labels'];
}) {
  const empty =
    !loading &&
    data !== null &&
    data.products.length + data.brands.length + data.categories.length === 0;

  // Compute starting indices for each section so hover/keyboard
  // highlight can be matched up cheaply.
  const productOffset = 0;
  const categoryOffset = data?.products.length ?? 0;
  const brandOffset = (data?.products.length ?? 0) + (data?.categories.length ?? 0);

  return (
    <div
      id="search-suggestions"
      role="listbox"
      className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      style={{ animation: 'fadeIn 160ms ease-out' }}
    >
      {loading && <SuggestionsSkeleton />}

      {empty && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
              <path d="m8 8 6 6M14 8l-6 6" />
            </svg>
          </span>
          <p className="text-sm font-semibold text-slate-700">
            {labels.noResults ?? 'No matches found.'}
          </p>
          <p className="text-xs text-slate-500">
            &ldquo;{query}&rdquo;
          </p>
        </div>
      )}

      {data && data.products.length > 0 && (
        <Section heading={labels.productsHeading ?? 'Products'}>
          {data.products.map((p, i) => {
            const idx = productOffset + i;
            const active = idx === selectedIndex;
            return (
              <Link
                id={`search-opt-${idx}`}
                key={p.id}
                role="option"
                aria-selected={active}
                href={`/${locale}/products/${p.slug}`}
                onMouseEnter={() => onHover(idx)}
                onClick={(e) => {
                  // Let cmd/ctrl-click work naturally; intercept normal clicks
                  // to also close the panel.
                  if (e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  onSelect({ kind: 'product', item: p });
                }}
                className={`flex items-center gap-3 px-3 py-2 text-sm transition ${
                  active ? 'bg-orange-50' : 'hover:bg-slate-50'
                }`}
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 flex-none rounded-md border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-md bg-slate-100 text-[10px] font-medium uppercase text-slate-500">
                    {p.title.slice(0, 2)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">
                    {highlight(p.title, query)}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {p.brandName ? `${p.brandName} · ` : ''}
                    {p.categoryName}
                  </span>
                </span>
                <span className="flex-none whitespace-nowrap text-sm font-semibold text-slate-900">
                  {formatPrice(p.price, p.currency)}
                </span>
              </Link>
            );
          })}
        </Section>
      )}

      {data && data.categories.length > 0 && (
        <Section heading={labels.categoriesHeading ?? 'Categories'}>
          {data.categories.map((c, i) => {
            const idx = categoryOffset + i;
            const active = idx === selectedIndex;
            return (
              <Link
                id={`search-opt-${idx}`}
                key={c.id}
                role="option"
                aria-selected={active}
                href={`/${locale}/products?category=${encodeURIComponent(c.slug)}`}
                onMouseEnter={() => onHover(idx)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  onSelect({ kind: 'category', item: c });
                }}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition ${
                  active ? 'bg-orange-50' : 'hover:bg-slate-50'
                }`}
              >
                <TagIcon className="h-4 w-4 text-slate-400" />
                <span className="truncate font-medium text-slate-700">
                  {highlight(c.name, query)}
                </span>
              </Link>
            );
          })}
        </Section>
      )}

      {data && data.brands.length > 0 && (
        <Section heading={labels.brandsHeading ?? 'Brands'}>
          {data.brands.map((b, i) => {
            const idx = brandOffset + i;
            const active = idx === selectedIndex;
            return (
              <Link
                id={`search-opt-${idx}`}
                key={b.id}
                role="option"
                aria-selected={active}
                href={`/${locale}/products?q=${encodeURIComponent(b.name)}`}
                onMouseEnter={() => onHover(idx)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  onSelect({ kind: 'brand', item: b });
                }}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition ${
                  active ? 'bg-orange-50' : 'hover:bg-slate-50'
                }`}
              >
                <StoreIcon className="h-4 w-4 text-slate-400" />
                <span className="truncate font-medium text-slate-700">
                  {highlight(b.name, query)}
                </span>
              </Link>
            );
          })}
        </Section>
      )}

      {flatItems.length > 0 && (
        <button
          type="button"
          onClick={onSeeAll}
          className="w-full border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-start text-xs font-semibold text-orange-600 transition hover:bg-orange-50"
        >
          {(labels.seeAll ?? 'See all results for')} &ldquo;{query}&rdquo; →
        </button>
      )}
    </div>
  );
}

function Section({
  heading,
  children
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {heading}
      </p>
      {children}
    </div>
  );
}

/**
 * Skeleton rows shown while a search request is in flight. Three rows
 * is enough to suggest "results are coming" without trying to mimic
 * the eventual layout pixel-by-pixel.
 */
function SuggestionsSkeleton() {
  return (
    <div className="py-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <span className="h-10 w-10 animate-pulse rounded-md bg-slate-100" />
          <span className="flex-1 space-y-1.5">
            <span
              className="block h-3 animate-pulse rounded-full bg-slate-100"
              style={{ width: `${70 - i * 10}%` }}
            />
            <span
              className="block h-2.5 animate-pulse rounded-full bg-slate-100"
              style={{ width: `${45 - i * 8}%` }}
            />
          </span>
          <span className="h-3 w-10 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Wraps every case-insensitive occurrence of `q` in <mark>. We split
 * around the matched ranges instead of using a regex `.replace()` so
 * that React reconciles individual nodes (no `dangerouslySetInnerHTML`
 * = no XSS risk on the suggestion text).
 */
function highlight(text: string, q: string) {
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const found = lower.indexOf(needle, i);
    if (found < 0) {
      parts.push(text.slice(i));
      break;
    }
    if (found > i) parts.push(text.slice(i, found));
    parts.push(
      <mark
        key={found}
        className="bg-orange-100 text-orange-900 rounded-sm px-0.5"
      >
        {text.slice(found, found + needle.length)}
      </mark>
    );
    i = found + needle.length;
  }
  return parts;
}

function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    // Some legacy rows use 3-letter codes that Intl can't resolve.
    return `${amount.toFixed(0)} ${currency}`;
  }
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 12 12 20l-9-9V3h8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M9 13h6" />
    </svg>
  );
}
