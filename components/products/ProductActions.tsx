import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { AddToCartControl } from '@/components/cart/AddToCartControl';
import { ChatWithSellerButton } from '@/components/chat/ChatWithSellerButton';
import { Price } from '@/components/currency/Price';
import { WishlistButton } from '@/components/wishlist/WishlistButton';
import type { Product } from '@/types/product';

type ProductActionsProps = {
  product: Product;
  locale: string;
  isAuthenticated?: boolean;
  currentUserId?: string | null;
  inWishlist?: boolean;
  whatsappSettings?: {
    phone: string;
    defaultMessage: string;
    isEnabled: boolean;
    showFloating: boolean;
    showOnProduct: boolean;
  };
  siteOrigin?: string;
};

export function ProductActions({
  product,
  locale,
  isAuthenticated = false,
  currentUserId = null,
  inWishlist = false,
  whatsappSettings,
  siteOrigin = ''
}: ProductActionsProps) {
  const t = useTranslations('products');
  const inStock = product.stock > 0;

  const priceAmount =
    typeof product.price === 'number' ? product.price : Number(product.price);

  const contactHref = product.supplier
    ? `/${locale}/suppliers/${product.supplier.id}/contact`
    : `/${locale}/contact`;

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {t('price')}
          </div>
          <Price
            amount={priceAmount}
            locale={locale}
            from={product.currency}
            className="mt-1 block text-3xl font-bold text-slate-900"
          />
        </div>

        <div
          className={
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ' +
            (inStock
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500')
          }
        >
          {inStock
            ? `${t('inStock')} · ${product.stock}`
            : t('outOfStock')}
        </div>

        {product.isB2B && (
          <div className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">
            <p className="font-semibold">{t('bulkAvailable')}</p>
            <p className="mt-1 text-indigo-700/80">
              {t('bulkHint')}
            </p>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <AddToCartControl
            productId={product.id}
            locale={locale}
            inStock={inStock}
            maxQuantity={product.stock}
          />

          <Link
            href={contactHref}
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
          >
            {t('contactSupplier')}
          </Link>

          {product.supplier?.userId &&
            product.supplier.userId !== currentUserId && (
              <ChatWithSellerButton
                sellerUserId={product.supplier.userId}
                locale={locale}
                isAuthenticated={isAuthenticated}
                returnPath={`/${locale}/products/${product.slug}`}
              />
            )}

          <WishlistButton
            productId={product.id}
            locale={locale}
            initialActive={inWishlist}
            isAuthenticated={isAuthenticated}
            variant="detail"
          />
        </div>

        <p className="pt-1 text-[11px] leading-relaxed text-slate-400">
          {t('securePurchase')}
        </p>
      </div>

    </aside>
  );
}
