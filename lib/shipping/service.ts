import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type {
  ShippingMethodDTO,
  ShippingMethodInput,
  ShippingZoneDTO,
  ShippingZoneInput
} from '@/types/shipping';

export class ShippingError extends Error {
  constructor(
    public code:
      | 'not_found'
      | 'inactive'
      | 'order_not_found'
      | 'order_not_editable'
      | 'validation',
    public status: number,
    message?: string,
    public details?: Record<string, string>
  ) {
    super(message ?? code);
  }
}

type ShippingRow = {
  id: string;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  estimatedDays: number;
  isActive: boolean;
  sortOrder: number;
  zoneId: string | null;
  minWeight: number | null;
  maxWeight: number | null;
  basePrice: Prisma.Decimal | null;
  pricePerKg: Prisma.Decimal | null;
  volumetricFactor: number | null;
  shippingClass: string | null;
};

function toDTO(row: ShippingRow): ShippingMethodDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    estimatedDays: row.estimatedDays,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    zoneId: row.zoneId,
    minWeight: row.minWeight,
    maxWeight: row.maxWeight,
    basePrice: row.basePrice !== null ? Number(row.basePrice) : null,
    pricePerKg: row.pricePerKg !== null ? Number(row.pricePerKg) : null,
    volumetricFactor: row.volumetricFactor,
    shippingClass: row.shippingClass
  };
}

type ZoneRow = {
  id: string;
  name: string;
  countries: string[];
  isActive: boolean;
  sortOrder: number;
};

function zoneToDTO(row: ZoneRow): ShippingZoneDTO {
  return {
    id: row.id,
    name: row.name,
    countries: row.countries,
    isActive: row.isActive,
    sortOrder: row.sortOrder
  };
}

function normalizeCountry(c: string): string {
  return c.trim().toUpperCase().slice(0, 8);
}

function validateZone(input: ShippingZoneInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  const name = input.name?.trim() ?? '';
  if (name.length < 2) errors.name = 'required';
  if (name.length > 80) errors.name = 'too_long';
  if (!Array.isArray(input.countries) || input.countries.length === 0) {
    errors.countries = 'required';
  }
  return Object.keys(errors).length ? errors : null;
}

// ---------------- Zone CRUD --------------------------------------------

export async function listShippingZones(
  opts: { activeOnly?: boolean } = {}
): Promise<ShippingZoneDTO[]> {
  const rows = await prisma.shippingZone.findMany({
    where: opts.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });
  return rows.map(zoneToDTO);
}

export async function getShippingZone(
  id: string
): Promise<ShippingZoneDTO | null> {
  const row = await prisma.shippingZone.findUnique({ where: { id } });
  return row ? zoneToDTO(row) : null;
}

export async function createShippingZone(
  input: ShippingZoneInput
): Promise<ShippingZoneDTO> {
  const errors = validateZone(input);
  if (errors) throw new ShippingError('validation', 400, 'invalid_zone', errors);
  const row = await prisma.shippingZone.create({
    data: {
      name: input.name.trim(),
      countries: input.countries.map(normalizeCountry),
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0
    }
  });
  return zoneToDTO(row);
}

export async function updateShippingZone(
  id: string,
  input: Partial<ShippingZoneInput>
): Promise<ShippingZoneDTO> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2)
      throw new ShippingError('validation', 400, 'invalid_zone', {
        name: 'required'
      });
    data.name = name;
  }
  if (input.countries !== undefined) {
    if (!Array.isArray(input.countries) || input.countries.length === 0) {
      throw new ShippingError('validation', 400, 'invalid_zone', {
        countries: 'required'
      });
    }
    data.countries = input.countries.map(normalizeCountry);
  }
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  if (input.sortOrder !== undefined && Number.isInteger(input.sortOrder)) {
    data.sortOrder = input.sortOrder;
  }
  try {
    const row = await prisma.shippingZone.update({ where: { id }, data });
    return zoneToDTO(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new ShippingError('not_found', 404);
    }
    throw err;
  }
}

export async function deleteShippingZone(id: string): Promise<void> {
  try {
    await prisma.shippingZone.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new ShippingError('not_found', 404);
    }
    throw err;
  }
}

/**
 * Resolve which zone covers a given country code.
 * Picks the first zone (by sortOrder) whose `countries` array contains
 * the code, falling back to the catch-all `"*"` zone.
 */
export async function findZoneForCountry(
  country: string
): Promise<ShippingZoneDTO | null> {
  const code = normalizeCountry(country);
  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
  });
  // Specific match first; '*' catch-all only if nothing else matches.
  const specific = zones.find((z) => z.countries.includes(code));
  if (specific) return zoneToDTO(specific);
  const wildcard = zones.find((z) => z.countries.includes('*'));
  return wildcard ? zoneToDTO(wildcard) : null;
}

/**
 * Return active shipping methods available for a given country.
 * Methods without a zone (legacy/global) are always returned.
 */
export async function listMethodsForCountry(
  country: string
): Promise<ShippingMethodDTO[]> {
  const zone = await findZoneForCountry(country);
  const rows = await prisma.shippingMethod.findMany({
    where: {
      isActive: true,
      OR: [{ zoneId: null }, ...(zone ? [{ zoneId: zone.id }] : [])]
    },
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }]
  });
  return rows.map(toDTO);
}

function validate(input: ShippingMethodInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  const name = input.name?.trim() ?? '';
  if (name.length < 2) errors.name = 'required';
  if (name.length > 80) errors.name = 'too_long';
  if (
    typeof input.price !== 'number' ||
    !Number.isFinite(input.price) ||
    input.price < 0
  ) {
    errors.price = 'invalid';
  }
  if (
    !Number.isInteger(input.estimatedDays) ||
    input.estimatedDays < 0 ||
    input.estimatedDays > 365
  ) {
    errors.estimatedDays = 'invalid';
  }
  return Object.keys(errors).length ? errors : null;
}

export async function listActiveShippingMethods(): Promise<ShippingMethodDTO[]> {
  const rows = await prisma.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }]
  });
  return rows.map(toDTO);
}

export async function listAllShippingMethods(): Promise<ShippingMethodDTO[]> {
  const rows = await prisma.shippingMethod.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
  });
  return rows.map(toDTO);
}

export async function getShippingMethod(
  id: string
): Promise<ShippingMethodDTO | null> {
  const row = await prisma.shippingMethod.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}

export async function createShippingMethod(
  input: ShippingMethodInput
): Promise<ShippingMethodDTO> {
  const errors = validate(input);
  if (errors) {
    throw new ShippingError('validation', 400, 'invalid_shipping', errors);
  }
  const row = await prisma.shippingMethod.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price: new Prisma.Decimal(input.price.toFixed(2)),
      estimatedDays: input.estimatedDays,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      zoneId: input.zoneId ?? null,
      minWeight: input.minWeight ?? null,
      maxWeight: input.maxWeight ?? null,
      basePrice:
        input.basePrice !== null && input.basePrice !== undefined
          ? new Prisma.Decimal(input.basePrice.toFixed(2))
          : null,
      pricePerKg:
        input.pricePerKg !== null && input.pricePerKg !== undefined
          ? new Prisma.Decimal(input.pricePerKg.toFixed(2))
          : null,
      volumetricFactor: input.volumetricFactor ?? null,
      shippingClass: input.shippingClass?.trim() || null
    }
  });
  return toDTO(row);
}

export async function updateShippingMethod(
  id: string,
  input: Partial<ShippingMethodInput>
): Promise<ShippingMethodDTO> {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) errors.name = 'required';
    else data.name = name;
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }
  if (input.price !== undefined) {
    if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0) {
      errors.price = 'invalid';
    } else {
      data.price = new Prisma.Decimal(input.price.toFixed(2));
    }
  }
  if (input.estimatedDays !== undefined) {
    if (!Number.isInteger(input.estimatedDays) || input.estimatedDays < 0) {
      errors.estimatedDays = 'invalid';
    } else {
      data.estimatedDays = input.estimatedDays;
    }
  }
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  if (input.sortOrder !== undefined && Number.isInteger(input.sortOrder)) {
    data.sortOrder = input.sortOrder;
  }
  if (input.zoneId !== undefined) {
    data.zoneId = input.zoneId || null;
  }
  if (input.minWeight !== undefined) {
    data.minWeight = input.minWeight === null ? null : Number(input.minWeight);
  }
  if (input.maxWeight !== undefined) {
    data.maxWeight = input.maxWeight === null ? null : Number(input.maxWeight);
  }
  if (input.basePrice !== undefined) {
    data.basePrice =
      input.basePrice === null || input.basePrice === undefined
        ? null
        : new Prisma.Decimal(Number(input.basePrice).toFixed(2));
  }
  if (input.pricePerKg !== undefined) {
    data.pricePerKg =
      input.pricePerKg === null || input.pricePerKg === undefined
        ? null
        : new Prisma.Decimal(Number(input.pricePerKg).toFixed(2));
  }
  if (input.volumetricFactor !== undefined) {
    data.volumetricFactor =
      input.volumetricFactor === null ? null : Number(input.volumetricFactor);
  }
  if (input.shippingClass !== undefined) {
    data.shippingClass = input.shippingClass?.trim() || null;
  }

  if (Object.keys(errors).length) {
    throw new ShippingError('validation', 400, 'invalid_shipping', errors);
  }

  try {
    const row = await prisma.shippingMethod.update({
      where: { id },
      data
    });
    return toDTO(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new ShippingError('not_found', 404);
    }
    throw err;
  }
}

export async function deleteShippingMethod(id: string): Promise<void> {
  try {
    await prisma.shippingMethod.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new ShippingError('not_found', 404);
    }
    throw err;
  }
}

/**
 * Atomically attach an address + shipping method to an order and
 * recalculate `totalPrice = sum(items) + shipping.price`.
 *
 * Price is always read from the DB — never from the client.
 */
export async function selectShippingForOrder(options: {
  orderId: string;
  userId: string;
  isAdmin: boolean;
  addressId: string;
  shippingMethodId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: options.orderId },
      include: { items: true }
    });
    if (!order) throw new ShippingError('order_not_found', 404);
    if (!options.isAdmin && order.userId !== options.userId) {
      throw new ShippingError('order_not_editable', 403);
    }
    if (order.status !== 'PENDING') {
      throw new ShippingError('order_not_editable', 409);
    }

    const address = await tx.address.findFirst({
      where: { id: options.addressId, userId: order.userId }
    });
    if (!address) throw new ShippingError('not_found', 404, 'address_not_found');

    const method = await tx.shippingMethod.findUnique({
      where: { id: options.shippingMethodId }
    });
    if (!method) throw new ShippingError('not_found', 404, 'shipping_not_found');
    if (!method.isActive) throw new ShippingError('inactive', 409);

    // Engine-driven pricing. Falls back to the flat `method.price` for
    // legacy methods that don't define basePrice/pricePerKg, so this
    // change is fully backward compatible.
    const productIds = order.items.map((it) => it.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        weight: true,
        length: true,
        width: true,
        height: true,
        shippingClass: true
      }
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const calcItems = order.items.map((it) => {
      const p = byId.get(it.productId);
      return {
        weight: p?.weight ?? null,
        length: p?.length ?? null,
        width: p?.width ?? null,
        height: p?.height ?? null,
        shippingClass: p?.shippingClass ?? null,
        quantity: it.quantity
      };
    });

    // Lazy-load to keep cycles small and avoid pulling the engine on
    // unrelated paths.
    const { calculateShipping } = await import('@/lib/shipping/calculate');
    const { quote } = await calculateShipping({
      country: address.country,
      items: calcItems,
      methodId: method.id
    });

    const shippingPrice = quote ? quote.total : Number(method.price);
    const itemsTotal = order.items.reduce(
      (sum, line) => sum + Number(line.price) * line.quantity,
      0
    );
    const discount = Number(order.discountAmount ?? 0);
    const total = Math.max(0, itemsTotal - discount) + shippingPrice;

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        addressId: address.id,
        shippingMethodId: method.id,
        shippingPrice: new Prisma.Decimal(shippingPrice.toFixed(2)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shippingBreakdown: (quote ?? null) as any,
        totalPrice: new Prisma.Decimal(total.toFixed(2))
      }
    });
    return updated;
  });
}
