import { getTranslations } from 'next-intl/server';

import type { OrderStatus } from '@prisma/client';

/**
 * Canonical forward progress flow. Cancelled is a terminal exit that
 * short-circuits this timeline and is rendered separately below.
 */
const FLOW: OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED'
];

const ICON_PATHS: Record<OrderStatus, string> = {
  PENDING: 'M12 8v4l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  PAID: 'M3 10h18M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM7 15h4',
  PROCESSING:
    'M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5l-1.4 1.4M7.9 16.1l-1.4 1.4m0-11l1.4 1.4m8.2 8.2l1.4 1.4',
  SHIPPED:
    'M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  DELIVERED: 'M5 12l4 4L19 6',
  CANCELLED: 'M6 6l12 12M6 18L18 6'
};

type Props = {
  locale: string;
  status: OrderStatus;
  updatedAt: Date;
  trackingCode?: string | null;
  carrier?: string | null;
  shippingMethodName?: string | null;
};

function formatDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

export async function OrderTimeline({
  locale,
  status,
  updatedAt,
  trackingCode,
  carrier,
  shippingMethodName
}: Props) {
  const t = await getTranslations({ locale, namespace: 'tracking' });

  const isCancelled = status === 'CANCELLED';
  const currentIndex = isCancelled ? -1 : FLOW.indexOf(status);

  const steps = FLOW.map((key, i) => {
    const state: 'done' | 'current' | 'pending' =
      i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'pending';
    return { key, state };
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {t('title')}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t('lastUpdate')}: {formatDateTime(updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ' +
              statusPillClass(status)
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {t(`status.${status}`)}
          </span>
        </div>
      </div>

      {/* Steps */}
      {isCancelled ? (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white">
            <StepIcon status="CANCELLED" />
          </span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {t('status.CANCELLED')}
            </p>
            <p className="text-xs text-red-700/80">{t('cancelledHint')}</p>
          </div>
        </div>
      ) : (
        <ol
          className="
            mt-6
            flex flex-col gap-6
            md:flex-row md:items-start md:gap-0
          "
          aria-label={t('title')}
        >
          {steps.map((step, i) => (
            <li
              key={step.key}
              className="relative flex items-start gap-3 md:flex-1 md:flex-col md:items-center md:text-center"
            >
              {/* Connector (desktop: horizontal; mobile: vertical) */}
              {i < steps.length - 1 && (
                <>
                  <span
                    aria-hidden
                    className={
                      'absolute start-[17px] top-9 h-[calc(100%+_1rem)] w-0.5 transition-colors md:hidden ' +
                      (step.state === 'done'
                        ? 'bg-emerald-500'
                        : 'bg-slate-200')
                    }
                  />
                  <span
                    aria-hidden
                    className={
                      'absolute top-[17px] hidden h-0.5 transition-colors md:block ' +
                      // Horizontal connector positioned from center of this
                      // dot to center of the next; RTL-safe using inset.
                      'start-[calc(50%+_18px)] end-[calc(-50%+_18px)] ' +
                      (step.state === 'done'
                        ? 'bg-emerald-500'
                        : 'bg-slate-200')
                    }
                  />
                </>
              )}

              <span
                className={
                  'relative z-10 inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 transition-all ' +
                  dotClass(step.state)
                }
              >
                <StepIcon status={step.key} done={step.state === 'done'} />
              </span>

              <div className="md:mt-2">
                <p
                  className={
                    'text-sm font-semibold ' +
                    (step.state === 'pending'
                      ? 'text-slate-400'
                      : 'text-slate-900')
                  }
                >
                  {t(`step.${step.key}`)}
                </p>
                {step.state === 'current' && (
                  <p className="mt-0.5 text-xs text-orange-600">
                    {t('inProgress')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Shipping / tracking footer */}
      <dl className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-sm sm:grid-cols-3">
        <Field label={t('shippingMethod')} value={shippingMethodName ?? '—'} />
        <Field label={t('carrier')} value={carrier ?? t('notAssigned')} />
        <Field
          label={t('trackingCode')}
          value={
            trackingCode ? (
              <span className="font-mono">{trackingCode}</span>
            ) : (
              t('notAssigned')
            )
          }
        />
      </dl>
    </section>
  );
}

function Field({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function StepIcon({
  status,
  done = false
}: {
  status: OrderStatus;
  done?: boolean;
}) {
  // When the step is done we prefer a simple check to keep the row visually
  // calm; active / pending steps keep their semantic icon.
  const path = done ? ICON_PATHS.DELIVERED : ICON_PATHS[status];
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

function dotClass(state: 'done' | 'current' | 'pending'): string {
  switch (state) {
    case 'done':
      return 'border-emerald-500 bg-emerald-500 text-white';
    case 'current':
      return 'border-orange-500 bg-orange-500 text-white shadow-[0_0_0_6px_rgba(249,115,22,0.15)]';
    default:
      return 'border-slate-200 bg-white text-slate-400';
  }
}

function statusPillClass(status: OrderStatus): string {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-700';
    case 'CANCELLED':
      return 'bg-red-50 text-red-700';
    case 'SHIPPED':
      return 'bg-blue-50 text-blue-700';
    case 'PROCESSING':
      return 'bg-amber-50 text-amber-700';
    case 'PAID':
      return 'bg-sky-50 text-sky-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
