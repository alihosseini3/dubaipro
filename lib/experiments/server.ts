import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';

import { pickVariant } from './assign';
import { getVisitorId } from './visitor';

/**
 * Active experiment payload returned to server components.
 * `null` means the caller should render its default UI.
 */
export type ActiveVariant = {
  experimentId: string;
  experimentKey: string;
  variantId: string;
  variantKey: string;
  config: Record<string, unknown>;
};

/**
 * Fetch the variant a visitor is assigned to for `experimentKey`.
 *
 * Wrapped in React's `cache()` so multiple components that ask for the
 * same experiment in one render share a single DB lookup. The cache is
 * scoped to the request automatically — no cross-request leakage.
 *
 * Returns `null` when:
 *   - the experiment doesn't exist or is inactive
 *   - it has no positively-weighted variants
 *   - we couldn't resolve a visitor id (extremely rare; bots without
 *     cookies and stripped headers)
 *
 * Callers must treat `null` as "show the default" so disabling an
 * experiment in the admin instantly reverts behavior site-wide.
 */
export const getActiveVariant = cache(async function getActiveVariant(
  experimentKey: string
): Promise<ActiveVariant | null> {
  const visitorId = await getVisitorId();
  if (!visitorId) return null;

  let exp:
    | {
        id: string;
        key: string;
        isActive: boolean;
        variants: { id: string; key: string; weight: number; config: unknown }[];
      }
    | null = null;
  try {
    exp = await prisma.experiment.findUnique({
      where: { key: experimentKey },
      select: {
        id: true,
        key: true,
        isActive: true,
        variants: {
          select: { id: true, key: true, weight: true, config: true }
        }
      }
    });
  } catch {
    // DB is the source of truth, but we never want a misconfigured
    // experiments table to take down a product page.
    return null;
  }

  if (!exp || !exp.isActive) return null;

  const picked = pickVariant(exp.variants, visitorId, exp.key);
  if (!picked) return null;

  return {
    experimentId: exp.id,
    experimentKey: exp.key,
    variantId: picked.id,
    variantKey: picked.key,
    config: (picked.config ?? {}) as Record<string, unknown>
  };
});
