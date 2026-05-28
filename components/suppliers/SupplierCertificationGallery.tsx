import { SmartImage } from '@/components/ui/SmartImage';
import { useTranslations } from 'next-intl';

type Cert = {
  id: string;
  type: string;
  title: string;
  issuer: string | null;
  fileUrl: string;
  thumbUrl: string | null;
  issuedAt: string | Date | null;
  expiresAt: string | Date | null;
};

const formatDate = (d: string | Date | null, locale: string) =>
  d ? new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'short' }) : '';

export function SupplierCertificationGallery({
  items,
  locale
}: {
  items: Cert[];
  locale: string;
}) {
  const t = useTranslations('suppliers');

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{t('certifications.empty')}</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => {
        const thumb = c.thumbUrl ?? c.fileUrl;
        const isImage = /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(thumb);
        return (
          <li
            key={c.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <a
              href={c.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <div className="relative aspect-[4/3] w-full bg-slate-50">
                {isImage ? (
                  <SmartImage
                    src={thumb}
                    alt={c.title}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
                    PDF
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {c.type}
                </p>
                <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900">
                  {c.title}
                </h3>
                {c.issuer ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {t('certifications.issuedBy', { issuer: c.issuer })}
                  </p>
                ) : null}
                {c.expiresAt ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {t('certifications.validUntil', {
                      date: formatDate(c.expiresAt, locale)
                    })}
                  </p>
                ) : null}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
