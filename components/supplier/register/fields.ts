/**
 * Shared field styling for the registration wizard.
 *
 * Mirrors the V2 dashboard primitives (see the FIELD constant in
 * components/supplier/products/ProductEditor.tsx) so the wizard finally looks
 * like the rest of the supplier panel: same focus ring, same dark-mode
 * variants, and logical properties (start/end, ms/me) so the ar/fa/ur RTL
 * locales lay out correctly instead of forcing an LTR layout.
 */

export const FIELD =
  'block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500';

export const LABEL =
  'block text-sm font-medium text-slate-700 dark:text-slate-200';

export const ERROR = 'mt-1 text-xs font-medium text-rose-600';

export const CARD =
  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 sm:p-8';

export const SECTION_TITLE =
  'text-sm font-semibold text-slate-800 dark:text-slate-100';

export const HINT = 'text-xs text-slate-400 dark:text-slate-500';

/** Images render as previews; anything else (PDF) shows a file placeholder. */
export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(url);
}
