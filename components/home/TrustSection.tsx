import type { ComponentType } from 'react';

import type { HomepageSectionDTO } from '@/lib/homepage/types';

import {
  BoltIcon,
  GlobeIcon,
  LockIcon,
  ShieldCheckIcon,
  TagIcon,
  TruckIcon
} from './icons';

type Props = { section: HomepageSectionDTO };

type Item = { title: string; description: string; icon?: string };

type IconComponent = ComponentType<{ className?: string }>;

const ICON_PALETTE: Record<
  string,
  { Icon: IconComponent; ring: string; bg: string }
> = {
  shield: { Icon: ShieldCheckIcon, ring: 'ring-emerald-200', bg: 'bg-emerald-50 text-emerald-600' },
  lock: { Icon: LockIcon, ring: 'ring-sky-200', bg: 'bg-sky-50 text-sky-600' },
  truck: { Icon: TruckIcon, ring: 'ring-orange-200', bg: 'bg-orange-50 text-orange-600' },
  tag: { Icon: TagIcon, ring: 'ring-violet-200', bg: 'bg-violet-50 text-violet-600' },
  globe: { Icon: GlobeIcon, ring: 'ring-rose-200', bg: 'bg-rose-50 text-rose-600' },
  bolt: { Icon: BoltIcon, ring: 'ring-amber-200', bg: 'bg-amber-50 text-amber-600' }
};

/**
 * Trust band — surfaces 3–6 reasons-to-buy as a uniform card grid.
 *
 * Items are admin-editable through `config.items`; an empty/missing
 * config falls back to a curated default in `lib/homepage/service.ts`.
 * Each item picks one of six accent palettes via its `icon` key.
 */
export function TrustSection({ section }: Props) {
  const items = ((section.config.items as Item[] | undefined) ?? []).filter(
    (x) => x && typeof x.title === 'string'
  );

  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="home-trust"
      className="rounded-3xl bg-gradient-to-br from-slate-50 to-white p-6 ring-1 ring-slate-200/70 sm:p-8 lg:p-10"
    >
      <div className="mb-8 max-w-2xl">
        <h2
          id="home-trust"
          className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
        >
          {section.title}
        </h2>
        {section.subtitle && (
          <p className="mt-2 text-sm text-slate-600">{section.subtitle}</p>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((item, i) => {
          const palette =
            ICON_PALETTE[item.icon ?? 'shield'] ?? ICON_PALETTE.shield;
          const { Icon } = palette;
          return (
            <li
              key={`${item.title}-${i}`}
              className="group flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:ring-slate-300 hover:shadow-md"
            >
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${palette.bg} ${palette.ring}`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
