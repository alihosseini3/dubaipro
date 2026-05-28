/**
 * GET /api/supplier/me — full profile of the authenticated supplier.
 * PUT /api/supplier/me — patch storefront fields. Sensitive trust columns
 *                        (`tier`, `status`, `verified`, `isFeatured`) are
 *                        deliberately NOT writable here — those go through
 *                        the admin verification workflow.
 */
import { NextResponse } from 'next/server';
import { BusinessType } from '@prisma/client';

import { badRequest, handlePrismaError } from '@/lib/api/errors';
import {
  isNonEmptyString,
  parseJsonBody,
  type ValidationErrors
} from '@/lib/api/validation';
import { getSupplierContextOrNull } from '@/lib/auth/require-supplier';
import {
  getSupplierById,
  updateSupplier,
  type UpdateSupplierInput
} from '@/lib/suppliers';

export const runtime = 'nodejs';

const MAX_TAGLINE = 160;
const MAX_DESCRIPTION = 5000;
const MAX_SHIPPING_NOTES = 1000;
const MAX_META_TITLE = 70;
const MAX_META_DESCRIPTION = 200;
const MAX_NAME = 200;
const MAX_CITY = 120;
const MAX_ADDRESS = 500;
const MAX_EXPORT_MARKETS = 50;

const VALID_BUSINESS = new Set<string>([
  'MANUFACTURER',
  'TRADING_COMPANY',
  'DISTRIBUTOR',
  'WHOLESALER',
  'AGENT',
  'OTHER'
]);

export async function GET() {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const supplier = await getSupplierById(ctx.supplier.id);
    if (!supplier) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ data: supplier });
  } catch (error) {
    return handlePrismaError(error, 'GET /api/supplier/me');
  }
}

type UpdateBody = Record<string, unknown>;

export async function PUT(request: Request) {
  const ctx = await getSupplierContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = await parseJsonBody<UpdateBody>(request);
  if (!parsed.ok) return badRequest(parsed.error);
  const body = parsed.data;

  const errors: ValidationErrors = {};
  const patch: UpdateSupplierInput = {};

  if (body.name !== undefined) {
    if (!isNonEmptyString(body.name) || body.name.length > MAX_NAME) {
      errors.name = `name must be 1..${MAX_NAME} chars`;
    } else patch.name = body.name.trim();
  }

  if (body.country !== undefined) {
    if (!isNonEmptyString(body.country)) errors.country = 'country is required';
    else patch.country = body.country.trim();
  }

  if (body.city !== undefined) {
    if (body.city === null) patch.city = null;
    else if (typeof body.city !== 'string' || body.city.length > MAX_CITY) {
      errors.city = `city must be a string ≤ ${MAX_CITY} chars`;
    } else patch.city = body.city.trim();
  }

  if (body.phone !== undefined) {
    if (body.phone === null) patch.phone = null;
    else if (typeof body.phone !== 'string') errors.phone = 'phone must be string';
    else {
      const digits = body.phone.replace(/\D+/g, '').slice(0, 30);
      patch.phone = digits.length === 0 ? null : digits;
    }
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string' || body.slug.trim().length === 0) {
      errors.slug = 'slug must be non-empty';
    } else patch.slug = body.slug.trim();
  }

  if (body.logoUrl !== undefined) {
    if (body.logoUrl === null) patch.logoUrl = null;
    else if (typeof body.logoUrl !== 'string') errors.logoUrl = 'logoUrl must be string';
    else patch.logoUrl = body.logoUrl;
  }

  if (body.bannerUrl !== undefined) {
    if (body.bannerUrl === null) patch.bannerUrl = null;
    else if (typeof body.bannerUrl !== 'string') errors.bannerUrl = 'bannerUrl must be string';
    else patch.bannerUrl = body.bannerUrl;
  }

  if (body.shortTagline !== undefined) {
    if (body.shortTagline === null) patch.shortTagline = null;
    else if (typeof body.shortTagline !== 'string' || body.shortTagline.length > MAX_TAGLINE) {
      errors.shortTagline = `shortTagline must be ≤ ${MAX_TAGLINE} chars`;
    } else patch.shortTagline = body.shortTagline.trim();
  }

  if (body.description !== undefined) {
    if (body.description === null) patch.description = null;
    else if (typeof body.description !== 'string' || body.description.length > MAX_DESCRIPTION) {
      errors.description = `description must be ≤ ${MAX_DESCRIPTION} chars`;
    } else patch.description = body.description;
  }

  if (body.businessType !== undefined) {
    if (body.businessType === null) patch.businessType = null;
    else if (
      typeof body.businessType !== 'string' ||
      !VALID_BUSINESS.has(body.businessType.toUpperCase())
    ) {
      errors.businessType = 'invalid businessType';
    } else patch.businessType = body.businessType.toUpperCase() as BusinessType;
  }

  if (body.yearEstablished !== undefined) {
    if (body.yearEstablished === null) patch.yearEstablished = null;
    else if (
      typeof body.yearEstablished !== 'number' ||
      !Number.isInteger(body.yearEstablished) ||
      body.yearEstablished < 1800 ||
      body.yearEstablished > new Date().getFullYear()
    ) {
      errors.yearEstablished = 'invalid yearEstablished';
    } else patch.yearEstablished = body.yearEstablished;
  }

  if (body.warehouseAddress !== undefined) {
    if (body.warehouseAddress === null) patch.warehouseAddress = null;
    else if (
      typeof body.warehouseAddress !== 'string' ||
      body.warehouseAddress.length > MAX_ADDRESS
    ) {
      errors.warehouseAddress = `warehouseAddress must be ≤ ${MAX_ADDRESS} chars`;
    } else patch.warehouseAddress = body.warehouseAddress.trim();
  }

  if (body.exportMarkets !== undefined) {
    if (!Array.isArray(body.exportMarkets)) {
      errors.exportMarkets = 'exportMarkets must be array of ISO codes';
    } else if (body.exportMarkets.length > MAX_EXPORT_MARKETS) {
      errors.exportMarkets = `up to ${MAX_EXPORT_MARKETS} markets`;
    } else {
      const clean: string[] = [];
      for (const v of body.exportMarkets) {
        if (typeof v !== 'string') {
          errors.exportMarkets = 'each market must be a string ISO code';
          break;
        }
        const code = v.trim().toUpperCase().slice(0, 8);
        if (code.length > 0 && !clean.includes(code)) clean.push(code);
      }
      if (!errors.exportMarkets) patch.exportMarkets = clean;
    }
  }

  if (body.minOrderQuantity !== undefined) {
    if (body.minOrderQuantity === null) patch.minOrderQuantity = null;
    else if (
      typeof body.minOrderQuantity !== 'number' ||
      !Number.isInteger(body.minOrderQuantity) ||
      body.minOrderQuantity < 1
    ) {
      errors.minOrderQuantity = 'minOrderQuantity must be a positive integer';
    } else patch.minOrderQuantity = body.minOrderQuantity;
  }

  if (body.shippingNotes !== undefined) {
    if (body.shippingNotes === null) patch.shippingNotes = null;
    else if (
      typeof body.shippingNotes !== 'string' ||
      body.shippingNotes.length > MAX_SHIPPING_NOTES
    ) {
      errors.shippingNotes = `shippingNotes must be ≤ ${MAX_SHIPPING_NOTES} chars`;
    } else patch.shippingNotes = body.shippingNotes;
  }

  if (body.metaTitle !== undefined) {
    if (body.metaTitle === null) patch.metaTitle = null;
    else if (typeof body.metaTitle !== 'string' || body.metaTitle.length > MAX_META_TITLE) {
      errors.metaTitle = `metaTitle must be ≤ ${MAX_META_TITLE} chars`;
    } else patch.metaTitle = body.metaTitle.trim();
  }

  if (body.metaDescription !== undefined) {
    if (body.metaDescription === null) patch.metaDescription = null;
    else if (
      typeof body.metaDescription !== 'string' ||
      body.metaDescription.length > MAX_META_DESCRIPTION
    ) {
      errors.metaDescription = `metaDescription must be ≤ ${MAX_META_DESCRIPTION} chars`;
    } else patch.metaDescription = body.metaDescription.trim();
  }

  if (Object.keys(errors).length > 0) {
    return badRequest('Validation failed', errors);
  }
  if (Object.keys(patch).length === 0) {
    return badRequest('No fields to update');
  }

  try {
    const updated = await updateSupplier(ctx.supplier.id, patch);
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handlePrismaError(error, 'PUT /api/supplier/me');
  }
}
