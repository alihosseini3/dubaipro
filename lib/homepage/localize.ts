import 'server-only';

import { translateMany } from '@/lib/i18n/translate';
import type { HomepageSectionDTO } from '@/lib/homepage/types';

/**
 * Walk every `HomepageSectionDTO` and translate every user-facing
 * string into the requested locale. The shape stays identical so
 * existing renderers keep working without changes — they just get
 * pre-translated strings.
 *
 * Strategy: collect every string into one flat array, fire a single
 * `translateMany()` (which itself batches into one provider call),
 * then write the translations back in-place using the recorded path.
 * This keeps the homepage to ONE upstream translation request even
 * when the page has 10 sections × 6 cards.
 */

type StringPath = {
  // Mutating callback keeps the type-narrowing local; the section
  // shapes are heterogeneous so a generic deep-set helper would lose
  // type safety for marginal gain.
  set: (value: string) => void;
  get: () => string;
};

export async function localizeSections(
  sections: HomepageSectionDTO[],
  locale: string
): Promise<HomepageSectionDTO[]> {
  if (!locale || locale.toLowerCase() === 'en') return sections;

  // Deep-clone with a structuredClone so writes are safe (the input
  // may be coming straight from a `react.cache()` value that gets
  // shared across the request tree).
  const cloned: HomepageSectionDTO[] = sections.map((s) =>
    structuredClone(s)
  ) as HomepageSectionDTO[];

  const paths: StringPath[] = [];
  for (const section of cloned) {
    collectSectionStrings(section, paths);
  }
  if (paths.length === 0) return cloned;

  const sources = paths.map((p) => p.get());
  const translated = await translateMany(sources, locale);
  for (let i = 0; i < paths.length; i++) {
    const value = translated[i];
    if (typeof value === 'string') paths[i].set(value);
  }
  return cloned;
}

/* -------------------------------------------------------------------------- */
/* Per-shape collectors                                                       */
/* -------------------------------------------------------------------------- */

function pushIfString(
  obj: Record<string, unknown>,
  key: string,
  out: StringPath[]
) {
  const v = obj[key];
  if (typeof v === 'string' && v.trim().length > 0) {
    out.push({
      get: () => obj[key] as string,
      set: (next) => {
        obj[key] = next;
      }
    });
  }
}

function collectSectionStrings(
  section: HomepageSectionDTO,
  out: StringPath[]
): void {
  // Top-level visible copy on every section.
  const top = section as unknown as Record<string, unknown>;
  for (const key of [
    'title',
    'subtitle',
    'badge',
    'ctaLabel',
    'ctaSecondaryLabel'
  ]) {
    pushIfString(top, key, out);
  }

  // Per-type config blobs. We translate text-bearing fields only and
  // leave IDs / hrefs / numbers alone.
  const cfg = section.config as Record<string, unknown> | null | undefined;
  if (!cfg) return;

  switch (section.type) {
    case 'TRUST':
      collectArray(cfg.items, out, ['title', 'description']);
      break;

    case 'GLOBAL_SHOPPING':
      collectArray(cfg.cards, out, ['title', 'description', 'ctaLabel']);
      break;

    case 'BECOME_SUPPLIER':
      collectStringArray(cfg.benefits, out);
      break;

    case 'AUCTION':
      collectArray(cfg.items, out, ['title']);
      break;

    // HERO / FEATURED_PRODUCTS / CATEGORIES / TOP_SUPPLIERS / BLOG / RFQ
    // pull their dynamic body copy from product/category/etc rows,
    // which are localised separately (categories/products/posts) or
    // have no extra strings of their own.
    default:
      break;
  }
}

function collectArray(
  raw: unknown,
  out: StringPath[],
  keys: string[]
): void {
  if (!Array.isArray(raw)) return;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    for (const k of keys) pushIfString(obj, k, out);
  }
}

function collectStringArray(raw: unknown, out: StringPath[]): void {
  if (!Array.isArray(raw)) return;
  for (let i = 0; i < raw.length; i++) {
    if (typeof raw[i] !== 'string') continue;
    const idx = i;
    out.push({
      get: () => raw[idx] as string,
      set: (next) => {
        raw[idx] = next;
      }
    });
  }
}
