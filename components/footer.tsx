import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-6 text-sm text-slate-500">
        <span>© {new Date().getFullYear()} dubaipro</span>
        <span>{t('rights')}</span>
      </div>
    </footer>
  );
}
