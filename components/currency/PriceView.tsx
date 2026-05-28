'use client';

import { formatDisplayFromAED } from '@/lib/currency/service';
import type { DisplayCurrency } from '@/types/currency';

type PriceViewProps = {
  /** Amount in AED (the canonical storage unit). */
  amount: number;
  /** Serialized display-currency snapshot produced on the server. */
  display: DisplayCurrency;
  as?: 'span' | 'div' | 'strong';
  className?: string;
};

/**
 * Client-side counterpart to `<Price>`. Takes a pre-computed
 * {@link DisplayCurrency} so it never performs I/O. Use this inside
 * interactive trees (cart, checkout, coupon panel, shipping picker) where
 * totals update locally in response to user input.
 */
export function PriceView({
  amount,
  display,
  as: Tag = 'span',
  className
}: PriceViewProps) {
  return <Tag className={className}>{formatDisplayFromAED(amount, display)}</Tag>;
}
