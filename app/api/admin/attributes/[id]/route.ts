import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  ATTRIBUTE_TYPES,
  deleteAttribute,
  getAttribute,
  isAttributeType,
  updateAttribute,
  type UpdateAttributeInput,
} from '@/lib/attributes/service';

export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9-]+$/;

type Ctx = { params: Promise<{ id: string }> };

function parseOptions(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (!trimmed || trimmed.length > 64) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function parseTranslations(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[a-z]{2}$/.test(k)) continue;
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (trimmed) out[k] = trimmed.slice(0, 120);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function GET(_req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await getAttribute(id);
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: UpdateAttributeInput = {};

  if (typeof body.name === 'string') {
    const n = body.name.trim().slice(0, 120);
    if (!n) return NextResponse.json({ error: 'name cannot be empty' }, { status: 422 });
    update.name = n;
  }
  if (typeof body.slug === 'string') {
    const s = body.slug.trim().slice(0, 64);
    if (!s || !SLUG_RE.test(s)) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 422 });
    }
    update.slug = s;
  }
  if (body.type !== undefined) {
    if (!isAttributeType(body.type)) {
      return NextResponse.json(
        { error: `type must be one of ${ATTRIBUTE_TYPES.join('|')}` },
        { status: 422 }
      );
    }
    update.type = body.type;
  }
  if (typeof body.unit === 'string') update.unit = body.unit.trim().slice(0, 16);
  if (typeof body.group === 'string') update.group = body.group.trim().slice(0, 64);
  if (body.options !== undefined) {
    const parsed = parseOptions(body.options);
    if (parsed === null) {
      return NextResponse.json({ error: 'options must be an array of strings' }, { status: 422 });
    }
    if (parsed.length > 100) {
      return NextResponse.json({ error: 'too many options (max 100)' }, { status: 422 });
    }
    update.options = parsed;
  }
  if (body.nameTranslations !== undefined) {
    const t = parseTranslations(body.nameTranslations);
    if (t) update.nameTranslations = t;
  }
  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    update.sortOrder = Math.trunc(body.sortOrder);
  }

  try {
    const data = await updateAttribute(id, update);
    return NextResponse.json({ data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return NextResponse.json({ error: 'slug already exists' }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  await deleteAttribute(id);
  return NextResponse.json({ ok: true });
}
