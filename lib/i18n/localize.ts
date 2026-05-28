import 'server-only';

import { translateMany } from './translate';

/**
 * Generic helpers for translating arrays/records of plain DTOs without
 * hand-writing a per-entity loop every time.
 *
 *   const products = await loadProducts(...);
 *   return localizeArray(products, locale, ['title', 'description']);
 *
 * Implementation notes:
 *   - The function is type-preserving: the returned array has exactly
 *     the same shape as the input.
 *   - Strings are collected from every row in one pass and sent to the
 *     translation pipeline as a single batch, so a 12-card grid still
 *     hits the upstream provider only once on a cold cache.
 *   - Empty / non-string fields are left untouched. Numbers, IDs and
 *     URLs never go near the translator.
 *   - `locale === source` short-circuits with the original array so
 *     callers don't have to guard the call.
 *
 * Use `localizeRecord` for a single object (page title metadata, etc).
 */

export async function localizeArray<T extends Record<string, unknown>>(
  rows: T[],
  locale: string,
  fields: ReadonlyArray<keyof T>
): Promise<T[]> {
  if (!rows || rows.length === 0) return rows;
  if (!locale || locale.toLowerCase() === 'en') return rows;
  if (fields.length === 0) return rows;

  // Collect every translatable string with a back-reference so we can
  // splice the result into the right slot afterwards.
  type Slot = {
    rowIndex: number;
    field: keyof T;
  };
  const slots: Slot[] = [];
  const sources: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (const field of fields) {
      const v = row[field];
      if (typeof v === 'string' && v.trim().length > 0) {
        slots.push({ rowIndex: i, field });
        sources.push(v);
      }
    }
  }
  if (slots.length === 0) return rows;

  const translated = await translateMany(sources, locale);

  // Clone at the row level so callers that hold the original reference
  // (e.g. a `react.cache()` value) aren't mutated.
  const out = rows.map((r) => ({ ...r })) as T[];
  for (let i = 0; i < slots.length; i++) {
    const { rowIndex, field } = slots[i];
    const next = translated[i];
    if (typeof next === 'string') {
      (out[rowIndex] as Record<keyof T, unknown>)[field] = next;
    }
  }
  return out;
}

export async function localizeRecord<T extends Record<string, unknown>>(
  row: T,
  locale: string,
  fields: ReadonlyArray<keyof T>
): Promise<T> {
  const [out] = await localizeArray([row], locale, fields);
  return out;
}
