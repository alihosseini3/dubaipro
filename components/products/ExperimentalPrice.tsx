import { ExperimentTracker } from '@/components/experiments/ExperimentTracker';
import { PRICING_EXPERIMENT_KEY, resolveProductPrice } from '@/lib/experiments/pricing';

type Props = {
  productId: string;
  basePrice: number;
  currency: string;
  /** Optional className for outer wrapper. */
  className?: string;
};

/**
 * Server component that renders a product price, applying any active
 * pricing A/B variant. Shows the strike-through original price next
 * to the experimental price so the user understands the discount.
 *
 * Mounts `<ExperimentTracker>` exactly once when an experiment is
 * applied — the IMPRESSION is recorded against the SAME experiment
 * id whose conversions will later land via the checkout's revenue
 * attribution path. No flicker: the variant is resolved server-side.
 *
 * Drop-in usage on the product detail page:
 *   <ExperimentalPrice productId={p.id} basePrice={Number(p.price)} currency={p.currency} />
 */
export async function ExperimentalPrice({
  productId,
  basePrice,
  currency,
  className
}: Props) {
  const resolved = await resolveProductPrice(productId, basePrice);

  if (!resolved.experimentApplied) {
    return (
      <span className={className}>
        {basePrice.toFixed(2)} {currency}
      </span>
    );
  }

  const discountPct = Math.round(
    ((resolved.originalPrice - resolved.shownPrice) / resolved.originalPrice) * 100
  );

  return (
    <span className={className}>
      <span className="text-base font-semibold text-emerald-700">
        {resolved.shownPrice.toFixed(2)} {currency}
      </span>
      <span className="ml-2 text-sm text-slate-400 line-through">
        {resolved.originalPrice.toFixed(2)}
      </span>
      {discountPct > 0 && (
        <span className="ml-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          −{discountPct}%
        </span>
      )}
      {resolved.experimentId && resolved.variantId && (
        <ExperimentTracker
          experimentId={resolved.experimentId}
          variantId={resolved.variantId}
          experimentKey={PRICING_EXPERIMENT_KEY}
        />
      )}
    </span>
  );
}
