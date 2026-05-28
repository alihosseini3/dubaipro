import 'server-only';

import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/api/validation';

/**
 * Supplier slug generator.
 *
 * Rules:
 * - Lowercase, ASCII-alphanumeric + hyphen only (delegated to `slugify`).
 * - Conflicts are resolved by appending `-2`, `-3`, … until unique.
 * - Empty input (after sanitising) falls back to `"supplier"` so we always
 *   produce a usable value — uniqueness still enforced.
 * - When `excludeSupplierId` is given, that row's own slug is allowed to
 *   match (useful for re-saves that keep the same slug).
 *
 * The function performs at most `MAX_PROBES` database lookups before
 * giving up and appending a short random suffix as a final fallback.
 */

const MAX_PROBES = 50;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function generateUniqueSupplierSlug(
  base: string,
  excludeSupplierId?: string
): Promise<string> {
  const safeBase = slugify(base) || 'supplier';

  let candidate = safeBase;
  for (let i = 1; i <= MAX_PROBES; i++) {
    const existing = await prisma.supplier.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!existing || existing.id === excludeSupplierId) {
      return candidate;
    }
    candidate = `${safeBase}-${i + 1}`;
  }

  // Extremely unlikely path: fall back to a random suffix.
  return `${safeBase}-${randomSuffix()}`;
}
