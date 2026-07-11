import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Read side of the audit trail (the write side lives in ./service.ts).
 * Keyset (cursor) pagination on (createdAt DESC, id DESC) — stable and O(1)
 * per page regardless of table depth, unlike OFFSET.
 */

export type AuditListFilters = {
  action?: string;
  entityType?: string;
  supplierId?: string;
  actorId?: string;
  cursor?: string | null;
  pageSize: number;
};

export async function listAuditLogs(filters: AuditListFilters) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: { startsWith: filters.action } } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {})
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: filters.pageSize + 1, // +1 = "has next page" probe
    ...(filters.cursor ? { skip: 1, cursor: { id: filters.cursor } } : {}),
    select: {
      id: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      supplierId: true,
      diff: true,
      metadata: true,
      createdAt: true
    }
  });

  const hasMore = rows.length > filters.pageSize;
  const items = hasMore ? rows.slice(0, filters.pageSize) : rows;

  // Resolve actor names in one query (no FK on the log table by design).
  const actorIds = [...new Set(items.map((r) => r.actorId).filter(Boolean))] as string[];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true }
      })
    : [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return {
    items: items.map((row) => ({
      ...row,
      actor: row.actorId ? (actorById.get(row.actorId) ?? null) : null
    })),
    nextCursor: hasMore ? items[items.length - 1].id : null
  };
}
