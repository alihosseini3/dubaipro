import { getTranslations } from 'next-intl/server';

import { listRateHistory } from '@/lib/currency/rates';
import type { Currency } from '@/types/currency';
import { BASE_CURRENCY, SUPPORTED_CURRENCIES } from '@/types/currency';

type Props = {
  locale: string;
};

/**
 * Compact timeline of the most recent rate changes across every target.
 * Reads the `CurrencyRateHistory` audit trail so admins can see who changed
 * what, when, and from which source (manual edit, live-API import, etc.).
 *
 * Fail-open: if the history table doesn't exist yet (migration not applied)
 * the sections render empty strings rather than crashing the settings page.
 */
export async function CurrencyRateHistoryPanel({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'admin.currency' });

  // Fetch one bucket per non-base currency in parallel, then flatten.
  const targets = SUPPORTED_CURRENCIES.filter(
    (c) => c !== BASE_CURRENCY
  ) as Currency[];

  const buckets = await Promise.all(
    targets.map(async (target) => ({
      target,
      rows: await listRateHistory(target, 5)
    }))
  );

  const hasAny = buckets.some((b) => b.rows.length > 0);
  if (!hasAny) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-xs text-slate-500">{t('historyEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {buckets.map((bucket) =>
        bucket.rows.length === 0 ? null : (
          <section key={bucket.target} className="space-y-2">
            <header className="flex items-baseline justify-between">
              <h3 className="font-mono text-xs font-bold text-slate-700">
                {BASE_CURRENCY} → {bucket.target}
              </h3>
              <span className="text-[11px] text-slate-400">
                {t('historyRecent', { count: bucket.rows.length })}
              </span>
            </header>
            <ol className="space-y-1.5">
              {bucket.rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-white px-3 py-2 text-xs transition-colors hover:border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900">
                      {r.rate.toFixed(6).replace(/\.?0+$/, '')}
                    </span>
                    <SourcePill source={r.source} t={t} />
                  </div>
                  <time
                    dateTime={r.createdAt}
                    className="text-[11px] tabular-nums text-slate-500"
                  >
                    {new Date(r.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        )
      )}
    </div>
  );
}

function SourcePill({
  source,
  t
}: {
  source: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const palette =
    source === 'api'
      ? 'bg-blue-50 text-blue-700'
      : source === 'seed'
        ? 'bg-slate-100 text-slate-600'
        : 'bg-emerald-50 text-emerald-700';
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ' +
        palette
      }
    >
      {t(`source_${source}` as 'source_manual')}
    </span>
  );
}
