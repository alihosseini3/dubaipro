import { getTranslations } from 'next-intl/server';

import { Price } from '@/components/currency/Price';
import { prisma } from '@/lib/prisma';
import { getPublicTiers, getPublicVariants } from '@/lib/products/service';

type Props = {
  productId: string;
  locale: string;
};

/**
 * B2B trade block on the product page: the volume-pricing ladder and the
 * available variants. Server component — renders nothing when the product
 * has neither, so it is safe to drop into every product page.
 */
export async function TierPricingTable({ productId, locale }: Props) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, currency: true }
  });
  if (!product) return null;

  const [tiers, variants] = await Promise.all([
    getPublicTiers(productId),
    getPublicVariants(productId)
  ]);
  if (tiers.length === 0 && variants.length === 0) return null;

  const t = await getTranslations({ locale, namespace: 'products.b2b' });

  return (
    <section className="space-y-6">
      {tiers.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {t('tierTitle')}
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 text-start">{t('quantity')}</th>
                  <th className="px-3 py-2 text-start">{t('unitPrice')}</th>
                  <th className="px-3 py-2 text-start">{t('leadTime')}</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {tier.maxQty
                        ? `${tier.minQty} – ${tier.maxQty}`
                        : t('andAbove', { qty: tier.minQty })}
                    </td>
                    <td className="px-3 py-2">
                      <Price
                        amount={tier.unitPrice}
                        from={tier.currency}
                        locale={locale}
                        className="font-bold text-orange-600"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {tier.leadTimeDays != null
                        ? t('days', { count: tier.leadTimeDays })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {variants.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {t('variantTitle')}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((variant) => (
              <div
                key={variant.id}
                className="rounded-xl border border-slate-200 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">
                    {variant.name}
                  </span>
                  {variant.unitPrice != null && (
                    <Price
                      amount={Number(variant.unitPrice)}
                      from={product.currency}
                      locale={locale}
                      className="text-sm font-bold text-orange-600"
                    />
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(variant.options as Record<string, string>).map(
                    ([key, value]) => (
                      <span
                        key={key}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                      >
                        {key}: {value}
                      </span>
                    )
                  )}
                  {variant.moq != null && (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-600">
                      MOQ {variant.moq}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
