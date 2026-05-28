import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

export default function ProductNotFound() {
  const t = useTranslations('products');
  const locale = useLocale();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-2 text-sm text-slate-500">{t('notFoundDescription')}</p>
      <Link
        href={`/${locale}/products`}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {t('backToProducts')}
      </Link>
    </div>
  );
}
