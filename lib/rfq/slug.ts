import 'server-only';

import { slugify } from '@/lib/api/validation';
import { prisma } from '@/lib/prisma';

const MAX_PROBES = 50;

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function generateUniqueRfqSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  const safeBase = slugify(base) || 'rfq';

  let candidate = safeBase;
  for (let i = 1; i <= MAX_PROBES; i++) {
    const existing = await prisma.rfqRequest.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${safeBase}-${i + 1}`;
  }

  return `${safeBase}-${randomSuffix()}`;
}
