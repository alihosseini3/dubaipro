// @ts-check
/**
 * One-off backfill for the Supplier Pro Phase 1 migration.
 *
 * Idempotent — safe to re-run. For every existing Supplier row this script:
 *   1. Generates a unique slug (when null) from `name` + numeric suffix.
 *   2. Sets `status = 'ACTIVE'` for any row that currently has the default
 *      `PENDING_REVIEW` BUT has at least one product (legacy data was
 *      implicitly live; we preserve that behaviour).
 *   3. Promotes `verified=true` rows to `tier=VERIFIED` + `verifiedAt=now`
 *      so the storefront badge shows correctly.
 *   4. Recomputes denormalised counters (followerCount, ratingAvg,
 *      ratingCount) from source tables in case any drift exists.
 *
 * Usage:
 *   node scripts/backfill-supplier-data.mjs
 *
 * Requires DATABASE_URL in the environment (same as Prisma).
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function uniqueSlug(base) {
  const safeBase = slugify(base) || 'supplier';
  let candidate = safeBase;
  for (let i = 1; i <= 50; i++) {
    const existing = await prisma.supplier.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!existing) return candidate;
    candidate = `${safeBase}-${i + 1}`;
  }
  return `${safeBase}-${Math.random().toString(36).slice(2, 8)}`;
}

async function backfill() {
  const suppliers = await prisma.supplier.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
      tier: true,
      status: true,
      verifiedAt: true,
      _count: { select: { products: true } }
    }
  });

  console.log(`[backfill] processing ${suppliers.length} suppliers`);
  let slugged = 0;
  let activated = 0;
  let promoted = 0;

  for (const s of suppliers) {
    /** @type {Record<string, unknown>} */
    const data = {};

    if (!s.slug) {
      data.slug = await uniqueSlug(s.name);
      slugged++;
    }

    if (s.status === 'PENDING_REVIEW' && s._count.products > 0) {
      data.status = 'ACTIVE';
      activated++;
    }

    if (s.verified && s.tier === 'STANDARD') {
      data.tier = 'VERIFIED';
      if (!s.verifiedAt) data.verifiedAt = new Date();
      promoted++;
    }

    if (Object.keys(data).length > 0) {
      await prisma.supplier.update({ where: { id: s.id }, data });
    }

    // Always recompute counters from the source-of-truth tables.
    const [followerCount, ratingAgg] = await Promise.all([
      prisma.supplierFollower.count({ where: { supplierId: s.id } }),
      prisma.supplierReview.aggregate({
        where: { supplierId: s.id },
        _avg: { rating: true },
        _count: { _all: true }
      })
    ]);
    const avg = ratingAgg._avg.rating ?? 0;
    await prisma.supplier.update({
      where: { id: s.id },
      data: {
        followerCount,
        ratingAvg: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
        ratingCount: ratingAgg._count._all
      }
    });
  }

  console.log(
    `[backfill] done — slugged=${slugged}, activated=${activated}, promoted=${promoted}`
  );
}

backfill()
  .catch((err) => {
    console.error('[backfill] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
