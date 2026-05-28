import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export type CheckoutStep = 'address' | 'shipping' | 'pay';

type CheckoutStepperProps = {
  current: CheckoutStep;
  orderId: string;
  locale: string;
  /** Steps the user has already completed — determines which links are clickable. */
  completed: {
    address: boolean;
    shipping: boolean;
  };
};

const STEP_ORDER: CheckoutStep[] = ['address', 'shipping', 'pay'];

export async function CheckoutStepper({
  current,
  orderId,
  locale,
  completed
}: CheckoutStepperProps) {
  const t = await getTranslations({ locale, namespace: 'checkout' });

  const labels: Record<CheckoutStep, string> = {
    address: t('stepAddress'),
    shipping: t('stepShipping'),
    pay: t('stepPay')
  };

  return (
    <ol className="mb-8 flex items-center gap-2 text-sm">
      {STEP_ORDER.map((step, index) => {
        const isCurrent = step === current;
        const isDone =
          (step === 'address' && completed.address) ||
          (step === 'shipping' && completed.shipping) ||
          (step === 'pay' && current !== 'pay' && completed.address && completed.shipping);
        const isClickable =
          step === 'address' ||
          (step === 'shipping' && completed.address) ||
          (step === 'pay' && completed.address && completed.shipping);

        const content = (
          <div
            className={
              'flex items-center gap-2.5 rounded-full px-3 py-1.5 transition ' +
              (isCurrent
                ? 'bg-slate-900 text-white shadow-sm'
                : isDone
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-500')
            }
          >
            <span
              className={
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ' +
                (isCurrent
                  ? 'bg-white/20 text-white'
                  : isDone
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-slate-500')
              }
            >
              {isDone ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className="font-semibold">{labels[step]}</span>
          </div>
        );

        return (
          <li key={step} className="flex items-center gap-2">
            {isClickable ? (
              <Link
                href={`/${locale}/checkout/${orderId}${step === 'pay' ? '/pay' : `/${step}`}`}
              >
                {content}
              </Link>
            ) : (
              content
            )}
            {index < STEP_ORDER.length - 1 && (
              <span className="hidden h-px w-6 bg-slate-200 sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
