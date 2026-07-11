import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import type { ZodType } from 'zod';

import { getCurrentUser, type SessionUser } from '@/lib/auth/session';
import {
  getSupplierContextOrNull,
  type SupplierMemberContext
} from '@/lib/auth/require-supplier';
import {
  isAdminRole,
  memberHasPermission,
  roleHasPermission,
  type Permission
} from '@/lib/auth/permissions';
import { TokenBucketLimiter, clientKey } from '@/lib/media/rate-limit';
import { recordAudit, requestMetadata } from '@/lib/audit/service';
import { badRequest, handlePrismaError } from './errors';
import type { ValidationErrors } from './validation';

/**
 * Central route-handler factory. Every NEW or MODIFIED API route must be
 * built with `createRoute` instead of hand-rolling auth/validation/audit:
 *
 *   export const POST = createRoute(
 *     {
 *       auth: 'supplier',
 *       body: productCreateSchema,
 *       rateLimit: { key: 'product-write', limit: 30, windowSeconds: 60 },
 *       audit: { action: 'product.create', entityType: 'Product' },
 *     },
 *     async ({ user, supplier, body, audit }) => {
 *       const product = await createProduct(supplier.id, body);
 *       audit.entityId = product.id;
 *       return NextResponse.json(product, { status: 201 });
 *     }
 *   );
 *
 * Guarantees:
 *   - auth levels compose the existing lib/auth guards (401/403 JSON, no redirects)
 *   - supplier routes receive the caller's own supplier — services must take
 *     supplierId from this context, never from the client payload
 *   - zod failures return the established `badRequest(error, details)` shape
 *   - unhandled errors flow through `handlePrismaError` (P2002/P2003/P2025 mapped)
 *   - successful responses (< 400) write an AuditLog row when `audit` is set
 *
 * Legacy routes migrate opportunistically when touched (docs/api-routes.md).
 */

type AuthLevel = 'public' | 'user' | 'supplier' | 'admin';

export type RateLimitConfig = {
  /** Logical bucket name; combined with the caller identity per request. */
  key: string;
  /** Max requests per window (also the burst capacity). */
  limit: number;
  windowSeconds: number;
};

export type AuditConfig = {
  /** Dot-scoped action code, e.g. "product.create". */
  action: string;
  /** Entity kind, e.g. "Product". */
  entityType: string;
};

/** Mutable per-request audit slot the handler can enrich before it returns. */
export type AuditSlot = {
  entityId?: string | null;
  supplierId?: string | null;
  diff?: { before?: unknown; after?: unknown };
};

type SupplierInfo = { id: string; name: string };

type AuthedContext<A extends AuthLevel> = A extends 'public'
  ? { user: SessionUser | null; supplier: null; member: null }
  : A extends 'supplier'
    ? { user: SessionUser; supplier: SupplierInfo; member: SupplierMemberContext }
    : { user: SessionUser; supplier: null; member: null };

export type RouteContext<A extends AuthLevel, TBody, TQuery> = AuthedContext<A> & {
  request: NextRequest;
  /** Resolved dynamic segment params (already awaited). */
  params: Record<string, string | string[]>;
  /** Parsed + validated body; `undefined` unless a `body` schema was given. */
  body: TBody;
  /** Parsed + validated search params; `undefined` unless `query` was given. */
  query: TQuery;
  /** Fill in entityId/diff so the success audit row is complete. */
  audit: AuditSlot;
};

export type RouteConfig<A extends AuthLevel, TBody, TQuery> = {
  auth: A;
  /**
   * Fine-grained permission (lib/auth/permissions.ts). With auth 'supplier'
   * it is checked against the caller's SupplierMember role + overrides;
   * with 'admin'/'user' against the global role matrix.
   */
  permission?: Permission;
  body?: ZodType<TBody>;
  query?: ZodType<TQuery>;
  rateLimit?: RateLimitConfig;
  audit?: AuditConfig;
};

type NextRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response>;

/* One shared limiter per logical bucket, reused across requests. */
const limiters = new Map<string, TokenBucketLimiter>();

function limiterFor(config: RateLimitConfig): TokenBucketLimiter {
  let limiter = limiters.get(config.key);
  if (!limiter) {
    limiter = new TokenBucketLimiter({
      capacity: config.limit,
      refillRate: config.limit / config.windowSeconds
    });
    limiters.set(config.key, limiter);
  }
  return limiter;
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function tooManyRequests() {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}

function zodDetails(issues: { path: PropertyKey[]; message: string }[]): ValidationErrors {
  const details: ValidationErrors = {};
  for (const issue of issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : '_';
    if (!(field in details)) details[field] = issue.message;
  }
  return details;
}

export function createRoute<
  A extends AuthLevel,
  TBody = undefined,
  TQuery = undefined
>(
  config: RouteConfig<A, TBody, TQuery>,
  handler: (context: RouteContext<A, TBody, TQuery>) => Promise<Response>
): NextRouteHandler {
  return async (request, routeContext) => {
    try {
      /* 1. Authentication / role gate */
      let user: SessionUser | null = null;
      let supplier: SupplierInfo | null = null;
      let member: SupplierMemberContext | null = null;

      if (config.auth === 'supplier') {
        const supplierContext = await getSupplierContextOrNull();
        if (!supplierContext) {
          return (await getCurrentUser()) ? forbidden() : unauthorized();
        }
        user = supplierContext.user;
        supplier = supplierContext.supplier;
        member = supplierContext.member;
        if (
          config.permission &&
          !memberHasPermission(member.role, config.permission, member.permissions)
        ) {
          return forbidden();
        }
      } else if (config.auth !== 'public') {
        user = await getCurrentUser();
        if (!user) return unauthorized();
        if (config.auth === 'admin' && !isAdminRole(user)) return forbidden();
        if (config.permission && !roleHasPermission(user, config.permission)) {
          return forbidden();
        }
      } else {
        user = await getCurrentUser();
      }

      /* 2. Rate limiting — per user when authenticated, per IP otherwise */
      if (config.rateLimit) {
        const identity = user?.id ?? clientKey(request);
        if (!limiterFor(config.rateLimit).allow(`${config.rateLimit.key}:${identity}`)) {
          return tooManyRequests();
        }
      }

      /* 3. Validation */
      let body = undefined as TBody;
      if (config.body) {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return badRequest('Invalid JSON body');
        }
        const parsed = config.body.safeParse(raw);
        if (!parsed.success) {
          return badRequest('Validation failed', zodDetails(parsed.error.issues));
        }
        body = parsed.data;
      }

      let query = undefined as TQuery;
      if (config.query) {
        const parsed = config.query.safeParse(
          Object.fromEntries(request.nextUrl.searchParams)
        );
        if (!parsed.success) {
          return badRequest('Invalid query parameters', zodDetails(parsed.error.issues));
        }
        query = parsed.data;
      }

      /* 4. Handler */
      const auditSlot: AuditSlot = {};
      const params = routeContext?.params ? await routeContext.params : {};
      const response = await handler({
        request,
        params,
        user,
        supplier,
        member,
        body,
        query,
        audit: auditSlot
      } as unknown as RouteContext<A, TBody, TQuery>);

      /* 5. Audit on success — fire-and-forget, never blocks the response */
      if (config.audit && response.status < 400) {
        void recordAudit({
          actorId: user?.id ?? null,
          action: config.audit.action,
          entityType: config.audit.entityType,
          entityId: auditSlot.entityId ?? null,
          supplierId: auditSlot.supplierId ?? supplier?.id ?? null,
          diff: auditSlot.diff,
          metadata: requestMetadata(request)
        });
      }

      return response;
    } catch (error) {
      return handlePrismaError(
        error,
        config.audit?.action ?? request.nextUrl.pathname
      );
    }
  };
}
