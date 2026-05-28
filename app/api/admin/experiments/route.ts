import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import { isNonEmptyString, parseJsonBody } from '@/lib/api/validation';
import { getAdminOrNull } from '@/lib/auth/require-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const KEY_RE = /^[a-z0-9_]{2,64}$/;
const VARIANT_KEY_RE = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * List all experiments (admin overview). Returns just shapes — full
 * results aggregations live behind the per-experiment detail endpoint.
 */
export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.experiment.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        variants: { orderBy: { key: 'asc' } },
        _count: { select: { events: true } }
      }
    });
    return NextResponse.json({ data: rows });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/admin/experiments');
  }
}

type CreateBody = {
  key?: unknown;
  name?: unknown;
  description?: unknown;
  isActive?: unknown;
  variants?: unknown;
};

type VariantInput = {
  key: string;
  name: string;
  weight: number;
  config: Prisma.InputJsonValue;
};

function parseVariants(raw: unknown): VariantInput[] | string {
  if (!Array.isArray(raw) || raw.length < 2) {
    return 'at least two variants required';
  }
  if (raw.length > 10) return 'too many variants';

  const seen = new Set<string>();
  const out: VariantInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return 'invalid variant';
    const v = item as Record<string, unknown>;
    if (typeof v.key !== 'string' || !VARIANT_KEY_RE.test(v.key)) {
      return 'invalid variant key';
    }
    if (seen.has(v.key)) return 'duplicate variant key';
    seen.add(v.key);
    if (!isNonEmptyString(v.name) || (v.name as string).length > 100) {
      return 'invalid variant name';
    }
    const weight =
      typeof v.weight === 'number' && Number.isFinite(v.weight) && v.weight >= 0
        ? Math.floor(v.weight)
        : 1;
    let config: Prisma.InputJsonValue = {};
    if (v.config !== undefined && v.config !== null) {
      if (typeof v.config !== 'object' || Array.isArray(v.config)) {
        return 'config must be an object';
      }
      config = v.config as Prisma.InputJsonValue;
    }
    out.push({ key: v.key, name: v.name as string, weight, config });
  }

  if (out.every((v) => v.weight === 0)) return 'all variant weights are zero';
  return out;
}

/**
 * Create a brand new experiment with its variants in one transaction.
 * Variants are required upfront — an experiment with zero arms can
 * never assign anyone and would just be noise in the admin list.
 */
export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = await parseJsonBody<CreateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  if (typeof body.key !== 'string' || !KEY_RE.test(body.key)) {
    return badRequest('key must match [a-z0-9_]{2,64}');
  }
  if (!isNonEmptyString(body.name) || (body.name as string).length > 120) {
    return badRequest('name required (max 120 chars)');
  }
  const description =
    body.description === null || body.description === undefined
      ? null
      : typeof body.description === 'string' && body.description.length <= 2000
        ? body.description
        : undefined;
  if (description === undefined) return badRequest('invalid description');

  const variants = parseVariants(body.variants);
  if (typeof variants === 'string') return badRequest(variants);

  const isActive = typeof body.isActive === 'boolean' ? body.isActive : false;

  try {
    const created = await prisma.experiment.create({
      data: {
        key: body.key,
        name: body.name as string,
        description,
        isActive,
        variants: { create: variants }
      },
      include: { variants: true }
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return handlePrismaError(error, 'POST /api/admin/experiments');
  }
}
