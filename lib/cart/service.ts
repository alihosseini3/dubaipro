import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';
import {
  computeDiscount,
  findAutoApplyCoupon,
  isCouponUsable,
  toAppliedDTO,
  type CouponCartLine
} from '@/lib/coupon/service';
import type { CartDTO, CartItemDTO } from '@/types/cart';

export const MAX_ITEM_QUANTITY = 999;

/**
 * Cart service
 * -------------
 * Centralizes all cart mutations so API routes stay thin. Each public
 * function resolves the user's single active cart (lazily creating one)
 * and returns a serializable `CartDTO` that the UI can render directly.
 *
 * Future hooks (kept as TODOs in individual functions):
 *   - coupon / promo application on `toDTO`
 *   - shipping + tax calculation on `toDTO`
 *   - per-supplier cart splitting on checkout
 */

const itemInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          currency: true,
          stock: true,
          imageUrl: true,
          // categoryId is needed to evaluate CATEGORY-scoped coupons.
          categoryId: true
        }
      }
    }
  },
  coupon: true
} as const;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof itemInclude }>;

export async function getOrCreateCart(userId: string): Promise<CartWithItems> {
  const existing = await prisma.cart.findUnique({
    where: { userId },
    include: itemInclude
  });
  if (existing) return existing;

  return prisma.cart.create({
    data: { userId },
    include: itemInclude
  });
}

export async function getCartDTO(userId: string): Promise<CartDTO> {
  const cart = await getOrCreateCart(userId);

  const subtotal = cart.items.reduce(
    (acc, line) => acc + Number(line.product.price) * line.quantity,
    0
  );
  const items: CouponCartLine[] = cart.items.map((l) => ({
    productId: l.productId,
    categoryId: l.product.categoryId,
    quantity: l.quantity,
    price: Number(l.product.price)
  }));
  const ctx = { userId, items };

  // Lazy cleanup: if the cart has a coupon that is no longer usable
  // (expired, scope no longer matches, etc.), detach it so subsequent
  // reads are consistent and the user sees an honest total.
  if (cart.coupon && cart.couponId) {
    if (!isCouponUsable(cart.coupon, subtotal, ctx)) {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { couponId: null }
      });
      cart.coupon = null;
      cart.couponId = null;
    }
  }

  // Auto-apply: if no manual coupon is attached, try the best matching
  // autoApply=true coupon. Stack rule: only one coupon per cart, so we
  // never override a user-attached code.
  if (!cart.couponId && cart.items.length > 0) {
    const auto = await findAutoApplyCoupon({ userId, subtotal, items });
    if (auto) {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { couponId: auto.id }
      });
      cart.coupon = auto;
      cart.couponId = auto.id;
    }
  }

  return toDTO(cart, ctx);
}

/**
 * Add a product to the cart. If it already exists, increment quantity.
 * Quantity is clamped to `[1, MAX_ITEM_QUANTITY]` and must not exceed stock.
 */
export async function addToCart(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartDTO> {
  const qty = normalizeQuantity(quantity);

  // Only approved+published products can enter a cart.
  const product = await prisma.product.findFirst({
    where: { id: productId, ...PUBLIC_PRODUCT_WHERE },
    select: { id: true, stock: true }
  });
  if (!product) {
    throw new CartError('product_not_found', 404);
  }

  const cart = await getOrCreateCart(userId);
  const existing = cart.items.find((i) => i.productId === productId);
  const nextQty = Math.min(
    (existing?.quantity ?? 0) + qty,
    MAX_ITEM_QUANTITY,
    product.stock > 0 ? product.stock : MAX_ITEM_QUANTITY
  );

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: nextQty }
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, quantity: nextQty }
    });
  }

  return getCartDTO(userId);
}

/**
 * Update a line's quantity. Pass `0` (or negative) to remove the line.
 */
export async function updateQuantity(
  userId: string,
  productId: string,
  quantity: number
): Promise<CartDTO> {
  const cart = await getOrCreateCart(userId);
  const line = cart.items.find((i) => i.productId === productId);
  if (!line) return toDTO(cart);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: line.id } });
    return getCartDTO(userId);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true }
  });
  const cap =
    product && product.stock > 0
      ? Math.min(product.stock, MAX_ITEM_QUANTITY)
      : MAX_ITEM_QUANTITY;

  const clamped = Math.min(Math.max(1, Math.trunc(quantity)), cap);

  await prisma.cartItem.update({
    where: { id: line.id },
    data: { quantity: clamped }
  });

  return getCartDTO(userId);
}

export async function removeFromCart(
  userId: string,
  productId: string
): Promise<CartDTO> {
  const cart = await getOrCreateCart(userId);
  const line = cart.items.find((i) => i.productId === productId);
  if (line) {
    await prisma.cartItem.delete({ where: { id: line.id } });
  }
  return getCartDTO(userId);
}

export async function clearCart(userId: string): Promise<void> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { id: true }
  });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}

export async function getItemCount(userId: string): Promise<number> {
  const result = await prisma.cartItem.aggregate({
    _sum: { quantity: true },
    where: { cart: { userId } }
  });
  return result._sum.quantity ?? 0;
}

/* ------------------------------------------------------------------ */

export class CartError extends Error {
  constructor(
    public code:
      | 'product_not_found'
      | 'out_of_stock'
      | 'empty_cart'
      | 'invalid_quantity',
    public status: number
  ) {
    super(code);
  }
}

function normalizeQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CartError('invalid_quantity', 400);
  }
  const n = Math.trunc(value);
  if (n < 1) throw new CartError('invalid_quantity', 400);
  return Math.min(n, MAX_ITEM_QUANTITY);
}

function toDTO(
  cart: CartWithItems,
  ctx?: { userId: string; items: CouponCartLine[] }
): CartDTO {
  const items: CartItemDTO[] = cart.items.map((line) => {
    const price = Number(line.product.price);
    const lineTotal = Number((price * line.quantity).toFixed(2));
    return {
      id: line.id,
      productId: line.productId,
      quantity: line.quantity,
      product: {
        id: line.product.id,
        title: line.product.title,
        slug: line.product.slug,
        price: line.product.price.toString(),
        currency: line.product.currency,
        stock: line.product.stock,
        imageUrl: line.product.imageUrl
      },
      lineTotal
    };
  });

  const subtotal = Number(
    items.reduce((acc, item) => acc + item.lineTotal, 0).toFixed(2)
  );
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const currency = items[0]?.product.currency ?? 'USD';

  // Coupon handling: if the attached coupon is no longer usable for the
  // current subtotal (e.g. user removed items and fell below the min),
  // silently drop it from the DTO. The DB row is fixed up lazily by
  // `getCartDTO` below so the UI never sees a stale coupon.
  let coupon = null;
  let discount = 0;
  if (cart.coupon && isCouponUsable(cart.coupon, subtotal, ctx)) {
    discount = computeDiscount(cart.coupon, subtotal);
    coupon = toAppliedDTO(cart.coupon, discount);
  }

  const total = Number(Math.max(0, subtotal - discount).toFixed(2));

  return {
    id: cart.id,
    items,
    subtotal,
    itemCount,
    currency,
    coupon,
    discount,
    total
  };
}
