/**
 * GET  /api/admin/media/cleanup   — preview what would be cleaned up
 * POST /api/admin/media/cleanup   — execute cleanup
 *
 * Body: { action: 'orphans' | 'stale_jobs' | 'duplicates' | 'all', dryRun?: boolean }
 *
 * Actions:
 *   orphans     — Assets with no MediaUsage rows (and older than 24h, in 'general' folder)
 *   stale_jobs  — MediaTransformJob rows that are done/failed and older than 7 days
 *   duplicates  — Keep newest asset per hash, soft-delete (move to 'archived') the rest
 *   all         — Run all three actions in sequence
 */

import { NextResponse } from 'next/server';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { emitMediaEvent } from '@/lib/observability/media-events';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const STALE_JOB_DAYS     = 7;
const ORPHAN_HOURS       = 24;
const ORPHAN_FOLDER      = 'general';  // only auto-clean general uploads

/* ── GET: preview ── */
export async function GET(_req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const orphanCutoff = new Date(Date.now() - ORPHAN_HOURS * 3_600_000);
    const staleJobCutoff = new Date(Date.now() - STALE_JOB_DAYS * 86_400_000);

    const [orphanCount, staleJobCount, duplicateGroups] = await Promise.all([
      prisma.mediaAsset.count({
        where: {
          usages:    { none: {} },
          createdAt: { lt: orphanCutoff },
          folder:    ORPHAN_FOLDER,
          NOT: { folder: 'archived' },
        },
      }),
      prisma.mediaTransformJob.count({
        where: {
          status:  { in: ['done', 'failed'] },
          doneAt:  { lt: staleJobCutoff },
        },
      }),
      prisma.mediaAsset.groupBy({
        by:      ['hash'],
        where:   { hash: { not: null } },
        having:  { hash: { _count: { gt: 1 } } },
        _count:  { hash: true },
        orderBy: { _count: { hash: 'desc' } },
      }),
    ]);

    const duplicateAssets = duplicateGroups.reduce((s, r) => s + r._count.hash - 1, 0);

    return NextResponse.json({
      preview: {
        orphans:         orphanCount,
        staleJobs:       staleJobCount,
        duplicateGroups: duplicateGroups.length,
        duplicateAssets,
        totalReclaimable: orphanCount + duplicateAssets,
      },
    });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/media/cleanup');
  }
}

/* ── POST: execute ── */
export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { action?: string; dryRun?: boolean };
  try {
    body = await request.json() as { action?: string; dryRun?: boolean };
  } catch {
    return badRequest('Expected JSON body');
  }

  const action = body.action as 'orphans' | 'stale_jobs' | 'duplicates' | 'all' | undefined;
  if (!action || !['orphans', 'stale_jobs', 'duplicates', 'all'].includes(action)) {
    return badRequest('action must be orphans | stale_jobs | duplicates | all');
  }
  const dryRun = body.dryRun === true;

  try {
    const results: Record<string, number> = {};

    if (action === 'orphans' || action === 'all') {
      results.orphansArchived = await cleanOrphans(dryRun);
    }
    if (action === 'stale_jobs' || action === 'all') {
      results.staleJobsDeleted = await cleanStaleJobs(dryRun);
    }
    if (action === 'duplicates' || action === 'all') {
      results.duplicatesArchived = await cleanDuplicates(dryRun);
    }

    if (!dryRun) {
      emitMediaEvent({
        event: 'cleanup_completed',
        userId: admin.id,
        meta: { action, ...results },
      });
    }

    return NextResponse.json({ dryRun, action, results });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/media/cleanup');
  }
}

/* ── Cleanup helpers ── */

async function cleanOrphans(dryRun: boolean): Promise<number> {
  const orphanCutoff = new Date(Date.now() - ORPHAN_HOURS * 3_600_000);
  const orphans = await prisma.mediaAsset.findMany({
    where: {
      usages:    { none: {} },
      createdAt: { lt: orphanCutoff },
      folder:    ORPHAN_FOLDER,
      NOT: { folder: 'archived' },
    },
    select: { id: true },
    take:   100,  // batch limit per run
  });

  if (orphans.length === 0 || dryRun) return orphans.length;

  /* Move to 'archived' rather than hard-delete for safety */
  await prisma.mediaAsset.updateMany({
    where: { id: { in: orphans.map((o) => o.id) } },
    data:  { folder: 'archived' },
  });
  return orphans.length;
}

async function cleanStaleJobs(dryRun: boolean): Promise<number> {
  const staleJobCutoff = new Date(Date.now() - STALE_JOB_DAYS * 86_400_000);
  const count = await prisma.mediaTransformJob.count({
    where: { status: { in: ['done', 'failed'] }, doneAt: { lt: staleJobCutoff } },
  });

  if (dryRun) return count;
  if (count === 0) return 0;

  await prisma.mediaTransformJob.deleteMany({
    where: { status: { in: ['done', 'failed'] }, doneAt: { lt: staleJobCutoff } },
  });
  return count;
}

async function cleanDuplicates(dryRun: boolean): Promise<number> {
  const groups = await prisma.mediaAsset.groupBy({
    by:      ['hash'],
    where:   { hash: { not: null } },
    having:  { hash: { _count: { gt: 1 } } },
    _count:  { hash: true },
    orderBy: { _count: { hash: 'desc' } },
    take:    50,
  });

  if (groups.length === 0 || dryRun) {
    return groups.reduce((s, r) => s + r._count.hash - 1, 0);
  }

  let archived = 0;
  for (const group of groups) {
    const hashVal = group.hash as string | null;
    if (!hashVal) continue;
    /* Keep the NEWEST asset (highest createdAt), archive the rest */
    const dupes = await prisma.mediaAsset.findMany({
      where:   { hash: hashVal },
      orderBy: { createdAt: 'desc' },
      select:  { id: true },
    });
    const toArchive = dupes.slice(1).map((d) => d.id);
    if (toArchive.length === 0) continue;

    await prisma.mediaAsset.updateMany({
      where: { id: { in: toArchive } },
      data:  { folder: 'archived' },
    });
    archived += toArchive.length;
  }
  return archived;
}
