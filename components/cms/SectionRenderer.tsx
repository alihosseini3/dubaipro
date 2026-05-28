import Link from 'next/link';

import type {
  CtaBlockConfig,
  FaqConfig,
  FeaturesGridConfig,
  HeroConfig,
  ImageBannerConfig,
  PageSectionDTO,
  RichTextConfig,
  SpacerConfig,
} from '@/lib/pages/types';

const SPACER_SIZE: Record<string, string> = {
  sm: '2rem',
  md: '4rem',
  lg: '6rem',
  xl: '8rem',
};

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function HeroSection({ config }: { config: HeroConfig }) {
  const align = config.textAlign ?? 'center';
  const alignCls =
    align === 'center'
      ? 'text-center items-center'
      : align === 'right'
        ? 'text-right items-end'
        : 'text-left items-start';

  return (
    <section className="relative overflow-hidden bg-[#020617] text-white">
      {config.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${config.imageUrl})`,
            opacity: config.overlayOpacity != null ? 1 - config.overlayOpacity / 100 : 0.35,
          }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" aria-hidden />
      <div className={`relative mx-auto max-w-5xl px-4 py-24 flex flex-col gap-6 ${alignCls}`}>
        {config.badge && (
          <span className="inline-block rounded-full border border-orange-400/40 bg-orange-500/10 px-4 py-1 text-sm font-medium text-orange-300">
            {config.badge}
          </span>
        )}
        {config.heading && (
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {config.heading}
          </h1>
        )}
        {config.subheading && (
          <p className="max-w-2xl text-lg text-slate-300 sm:text-xl">{config.subheading}</p>
        )}
        {(config.ctaLabel || config.ctaSecondaryLabel) && (
          <div className={`flex flex-wrap gap-3 ${align === 'center' ? 'justify-center' : ''}`}>
            {config.ctaLabel && config.ctaHref && (
              <Link
                href={config.ctaHref}
                className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-orange-600"
              >
                {config.ctaLabel}
              </Link>
            )}
            {config.ctaSecondaryLabel && config.ctaSecondaryHref && (
              <Link
                href={config.ctaSecondaryHref}
                className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {config.ctaSecondaryLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Rich Text                                                                   */
/* -------------------------------------------------------------------------- */

function RichTextSection({ config }: { config: RichTextConfig }) {
  if (!config.html) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div
        className="prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: config.html }}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Image Banner                                                                */
/* -------------------------------------------------------------------------- */

function ImageBannerSection({ config }: { config: ImageBannerConfig }) {
  if (!config.imageUrl) return null;
  const aspectMap: Record<string, string> = {
    '16/9': 'aspect-video',
    '4/3': 'aspect-4/3',
    '21/9': 'aspect-[21/9]',
    auto: '',
  };
  const aspectCls = aspectMap[config.aspectRatio ?? '16/9'] ?? 'aspect-video';
  const inner = (
    <div className={`overflow-hidden rounded-2xl ${aspectCls}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.imageUrl}
        alt={config.alt ?? ''}
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {config.caption && (
        <p className="mt-2 text-center text-xs text-slate-500">{config.caption}</p>
      )}
    </div>
  );
  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      {config.href ? (
        <Link href={config.href}>{inner}</Link>
      ) : (
        inner
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* CTA Block                                                                   */
/* -------------------------------------------------------------------------- */

const CTA_BG: Record<string, string> = {
  default: 'bg-slate-50 border border-slate-200',
  accent: 'bg-[#F97316] text-white',
  dark: 'bg-[#0F172A] text-white',
};

function CtaBlockSection({ config }: { config: CtaBlockConfig }) {
  const variant = config.variant ?? 'default';
  const isLight = variant === 'default';
  return (
    <section className={`py-16 ${CTA_BG[variant]}`}>
      <div className="mx-auto max-w-3xl px-4 text-center space-y-6">
        {config.heading && (
          <h2
            className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${isLight ? 'text-slate-900' : 'text-white'}`}
          >
            {config.heading}
          </h2>
        )}
        {config.subheading && (
          <p className={`text-lg ${isLight ? 'text-slate-600' : 'text-white/80'}`}>
            {config.subheading}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {config.ctaLabel && config.ctaHref && (
            <Link
              href={config.ctaHref}
              className={`rounded-xl px-6 py-3 text-sm font-semibold shadow transition
                ${variant === 'accent'
                  ? 'bg-white text-orange-600 hover:bg-orange-50'
                  : variant === 'dark'
                    ? 'bg-[#F97316] text-white hover:bg-orange-600'
                    : 'bg-[#0F172A] text-white hover:bg-slate-800'
                }`}
            >
              {config.ctaLabel}
            </Link>
          )}
          {config.ctaSecondaryLabel && config.ctaSecondaryHref && (
            <Link
              href={config.ctaSecondaryHref}
              className={`rounded-xl border px-6 py-3 text-sm font-semibold transition
                ${isLight
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-white/30 text-white hover:bg-white/10'
                }`}
            >
              {config.ctaSecondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Features Grid                                                               */
/* -------------------------------------------------------------------------- */

const GRID_COLS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

function FeaturesGridSection({ config }: { config: FeaturesGridConfig }) {
  const cols = config.columns ?? 3;
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      {(config.heading || config.subheading) && (
        <div className="mb-10 text-center space-y-2">
          {config.heading && (
            <h2 className="text-3xl font-extrabold text-slate-900">{config.heading}</h2>
          )}
          {config.subheading && (
            <p className="text-slate-500">{config.subheading}</p>
          )}
        </div>
      )}
      <div className={`grid grid-cols-1 gap-6 ${GRID_COLS[cols] ?? 'sm:grid-cols-3'}`}>
        {(config.items ?? []).map((item, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 transition hover:shadow-md"
          >
            {item.icon && <span className="text-3xl">{item.icon}</span>}
            {item.title && (
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
            )}
            {item.description && (
              <p className="text-sm text-slate-600">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                         */
/* -------------------------------------------------------------------------- */

function FaqSection({ config }: { config: FaqConfig }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      {config.heading && (
        <h2 className="mb-8 text-3xl font-extrabold text-slate-900 text-center">
          {config.heading}
        </h2>
      )}
      <div className="divide-y divide-slate-200">
        {(config.items ?? []).map((item, i) => (
          <details key={i} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900">
              {item.question}
              <svg
                className="h-5 w-5 flex-shrink-0 text-slate-400 transition group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Spacer                                                                      */
/* -------------------------------------------------------------------------- */

function SpacerSection({ config }: { config: SpacerConfig }) {
  const h = SPACER_SIZE[config.height ?? 'md'] ?? '4rem';
  return <div style={{ height: h }} aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Dispatcher                                                                  */
/* -------------------------------------------------------------------------- */

export function SectionRenderer({ sections }: { sections: PageSectionDTO[] }) {
  return (
    <>
      {sections
        .filter((s) => s.isVisible)
        .map((section) => {
          switch (section.type) {
            case 'HERO':
              return (
                <HeroSection key={section.id} config={section.config as HeroConfig} />
              );
            case 'RICH_TEXT':
              return (
                <RichTextSection
                  key={section.id}
                  config={section.config as RichTextConfig}
                />
              );
            case 'IMAGE_BANNER':
              return (
                <ImageBannerSection
                  key={section.id}
                  config={section.config as ImageBannerConfig}
                />
              );
            case 'CTA_BLOCK':
              return (
                <CtaBlockSection
                  key={section.id}
                  config={section.config as CtaBlockConfig}
                />
              );
            case 'FEATURES_GRID':
              return (
                <FeaturesGridSection
                  key={section.id}
                  config={section.config as FeaturesGridConfig}
                />
              );
            case 'FAQ':
              return (
                <FaqSection key={section.id} config={section.config as FaqConfig} />
              );
            case 'SPACER':
              return (
                <SpacerSection
                  key={section.id}
                  config={section.config as SpacerConfig}
                />
              );
            default:
              return null;
          }
        })}
    </>
  );
}
