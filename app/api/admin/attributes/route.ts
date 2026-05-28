import { NextResponse } from 'next/server';

import { getAdminOrNull } from '@/lib/auth/require-admin';
import {
  ATTRIBUTE_TYPES,
  createAttribute,
  isAttributeType,
  listAttributes,
  needsOptions,
  type AttributeType,
  type CreateAttributeInput,
} from '@/lib/attributes/service';

export const runtime = 'nodejs';

const SLUG_RE = /^[a-z0-9-]+$/;
const MAX_UNIT_LEN = 16;
const MAX_GROUP_LEN = 64;
const MAX_OPTION_LEN = 64;
const MAX_OPTIONS = 100;

function parseStringArray(input: unknown, { maxLen = MAX_OPTION_LEN }: { maxLen?: number } = {}): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (!trimmed || trimmed.length > maxLen) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function parseTranslations(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[a-z]{2}$/.test(k)) continue;
    if (typeof v !== 'string') continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    out[k] = trimmed.slice(0, 120);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function GET() {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const data = await listAttributes();
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().slice(0, 64) : '';
  const rawType = body.type;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 422 });
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with hyphens' }, { status: 422 });
  }
  if (!isAttributeType(rawType)) {
    return NextResponse.json(
      { error: `type must be one of ${ATTRIBUTE_TYPES.join('|')}` },
      { status: 422 }
    );
  }

  const type = rawType;
  const unit = typeof body.unit === 'string' ? body.unit.trim().slice(0, MAX_UNIT_LEN) : undefined;
  const group = typeof body.group === 'string' ? body.group.trim().slice(0, MAX_GROUP_LEN) : undefined;
  const nameTranslations = parseTranslations(body.nameTranslations) ?? undefined;

  let options: string[] | undefined;
  if (needsOptions(type)) {
    const parsed = parseStringArray(body.options);
    if (!parsed || parsed.length === 0) {
      return NextResponse.json(
        { error: `options required for type '${type}'` },
        { status: 422 }
      );
    }
    if (parsed.length > MAX_OPTIONS) {
      return NextResponse.json(
        { error: `too many options (max ${MAX_OPTIONS})` },
        { status: 422 }
      );
    }
    options = parsed;
  }

  const input: CreateAttributeInput = { name, slug, type, unit, group, nameTranslations, options };

  try {
    const data = await createAttribute(input);
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return NextResponse.json({ error: 'slug already exists' }, { status: 409 });
    }
    throw e;
  }
}

// Re-export type so callers of validation helpers can narrow correctly.
export type { AttributeType };
