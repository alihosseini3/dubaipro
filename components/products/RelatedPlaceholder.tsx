import { useTranslations } from 'next-intl';

export function RelatedPlaceholder() {
  const t = useTranslations('products');
  return (
    <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <h2 className="text-sm font-semibold text-slate-700">
        {t('relatedProducts')}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        {t('relatedComingSoon')}
      </p>
    </section>
  );
}
