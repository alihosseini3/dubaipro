import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * Central audit-trail writer (AuditLog model).
 *
 * Design rules:
 *   - Append-only; rows are never updated or deleted by application code.
 *   - `recordAudit` NEVER throws — an audit failure must not break the
 *     business action it describes. Failures are logged to stderr instead.
 *   - Domain logs (SupplierVerificationLog, AutomationLog, …) stay the
 *     detailed source of truth; this table is the cross-domain index.
 *
 * Action codes are dot-scoped strings: "<entity>.<verb>[.<detail>]",
 * e.g. "product.approve", "supplier.member.invite", "auth.login".
 */

export type AuditEntry = {
  /** Acting user id; omit/null for SYSTEM actions (cron, automation). */
  actorId?: string | null;
  /** Dot-scoped action code, e.g. "product.approve". Max 80 chars. */
  action: string;
  /** Entity kind, e.g. "Product", "Supplier". Max 40 chars. */
  entityType: string;
  entityId?: string | null;
  /** Owning supplier org, when the action happened inside one. */
  supplierId?: string | null;
  /** Snapshot of only the changed fields. */
  diff?: { before?: unknown; after?: unknown };
  /** Request context (ip, userAgent, …) — see requestMetadata(). */
  metadata?: Record<string, unknown>;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action.slice(0, 80),
        entityType: entry.entityType.slice(0, 40),
        entityId: entry.entityId ?? null,
        supplierId: entry.supplierId ?? null,
        diff: entry.diff ? JSON.parse(JSON.stringify(entry.diff)) : undefined,
        metadata: entry.metadata
          ? JSON.parse(JSON.stringify(entry.metadata))
          : undefined
      }
    });
  } catch (error) {
    console.error(`audit write failed (${entry.action}):`, error);
  }
}

/**
 * Extract request context worth persisting alongside an audit row.
 * Header names mirror lib/media/rate-limit.ts `clientKey`.
 */
export function requestMetadata(request: Request): Record<string, unknown> {
  const ip =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  const userAgent = request.headers.get('user-agent');
  return {
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {})
  };
}
