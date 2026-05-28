import { useTranslations } from 'next-intl';

export default function ContactPage() {
  const t = useTranslations('navbar');

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t('contact')}</h1>
    </section>
  );
}
