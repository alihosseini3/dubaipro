'use client';

import dynamic from 'next/dynamic';

import { ImageField } from '@/components/admin/builder/ImageField';

import type {
  AuctionShowcaseConfig,
  BlogPostsConfig,
  CtaBlockConfig,
  FaqConfig,
  FeaturesGridConfig,
  HeroConfig,
  ImageBannerConfig,
  ProductGridConfig,
  RichTextConfig,
  SectionConfig,
  SpacerConfig,
  StatsConfig,
  SupplierShowcaseConfig,
  TrustSectionConfig,
} from '@/lib/pages/types';

const RichTextEditor = dynamic(
  () =>
    import('./RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-xl bg-slate-100" /> }
);

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100';

/* -------------------------------------------------------------------------- */

export function HeroEditor({
  config,
  onChange,
}: {
  config: HeroConfig;
  onChange: (c: HeroConfig) => void;
}) {
  const set = <K extends keyof HeroConfig>(k: K, v: HeroConfig[K]) =>
    onChange({ ...config, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Heading">
        <input
          value={config.heading ?? ''}
          onChange={(e) => set('heading', e.target.value)}
          className={inputCls}
          placeholder="Main hero heading"
        />
      </Field>
      <Field label="Badge (optional)">
        <input
          value={config.badge ?? ''}
          onChange={(e) => set('badge', e.target.value)}
          className={inputCls}
          placeholder="e.g. New arrival"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Subheading">
          <textarea
            value={config.subheading ?? ''}
            onChange={(e) => set('subheading', e.target.value)}
            className={inputCls}
            rows={2}
            placeholder="Short subtitle paragraph"
          />
        </Field>
      </div>
      <ImageField
        label="Image URL"
        value={config.imageUrl ?? ''}
        onChange={(url) => set('imageUrl', url)}
      />
      <Field label="Text Align">
        <select
          value={config.textAlign ?? 'left'}
          onChange={(e) => set('textAlign', e.target.value as HeroConfig['textAlign'])}
          className={inputCls}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="CTA Label">
        <input
          value={config.ctaLabel ?? ''}
          onChange={(e) => set('ctaLabel', e.target.value)}
          className={inputCls}
          placeholder="Shop now"
        />
      </Field>
      <Field label="CTA URL">
        <input
          value={config.ctaHref ?? ''}
          onChange={(e) => set('ctaHref', e.target.value)}
          className={inputCls}
          placeholder="/products"
        />
      </Field>
      <Field label="Secondary CTA Label">
        <input
          value={config.ctaSecondaryLabel ?? ''}
          onChange={(e) => set('ctaSecondaryLabel', e.target.value)}
          className={inputCls}
          placeholder="Learn more"
        />
      </Field>
      <Field label="Secondary CTA URL">
        <input
          value={config.ctaSecondaryHref ?? ''}
          onChange={(e) => set('ctaSecondaryHref', e.target.value)}
          className={inputCls}
          placeholder="/about"
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function RichTextEditorSection({
  config,
  onChange,
  dir,
}: {
  config: RichTextConfig;
  onChange: (c: RichTextConfig) => void;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <RichTextEditor
      value={config.html ?? ''}
      onChange={(html) => onChange({ html })}
      dir={dir}
    />
  );
}

/* -------------------------------------------------------------------------- */

export function ImageBannerEditor({
  config,
  onChange,
}: {
  config: ImageBannerConfig;
  onChange: (c: ImageBannerConfig) => void;
}) {
  const set = <K extends keyof ImageBannerConfig>(k: K, v: ImageBannerConfig[K]) =>
    onChange({ ...config, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <ImageField
          label="Image URL"
          value={config.imageUrl ?? ''}
          onChange={(url) => set('imageUrl', url)}
        />
      </div>
      {config.imageUrl && (
        <div className="sm:col-span-2 overflow-hidden rounded-xl border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={config.imageUrl}
            alt={config.alt ?? 'Banner'}
            className="w-full object-cover max-h-64"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        </div>
      )}
      <Field label="Alt text">
        <input
          value={config.alt ?? ''}
          onChange={(e) => set('alt', e.target.value)}
          className={inputCls}
          placeholder="Describe the image"
        />
      </Field>
      <Field label="Link (optional)">
        <input
          value={config.href ?? ''}
          onChange={(e) => set('href', e.target.value)}
          className={inputCls}
          placeholder="/products"
        />
      </Field>
      <Field label="Caption (optional)">
        <input
          value={config.caption ?? ''}
          onChange={(e) => set('caption', e.target.value)}
          className={inputCls}
          placeholder="Image caption"
        />
      </Field>
      <Field label="Aspect Ratio">
        <select
          value={config.aspectRatio ?? '16/9'}
          onChange={(e) =>
            set('aspectRatio', e.target.value as ImageBannerConfig['aspectRatio'])
          }
          className={inputCls}
        >
          <option value="16/9">16:9</option>
          <option value="4/3">4:3</option>
          <option value="21/9">21:9</option>
          <option value="auto">Auto</option>
        </select>
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function CtaBlockEditor({
  config,
  onChange,
}: {
  config: CtaBlockConfig;
  onChange: (c: CtaBlockConfig) => void;
}) {
  const set = <K extends keyof CtaBlockConfig>(k: K, v: CtaBlockConfig[K]) =>
    onChange({ ...config, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Heading">
          <input
            value={config.heading ?? ''}
            onChange={(e) => set('heading', e.target.value)}
            className={inputCls}
            placeholder="Ready to get started?"
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Subheading">
          <textarea
            value={config.subheading ?? ''}
            onChange={(e) => set('subheading', e.target.value)}
            className={inputCls}
            rows={2}
            placeholder="Subheading text"
          />
        </Field>
      </div>
      <Field label="CTA Label">
        <input
          value={config.ctaLabel ?? ''}
          onChange={(e) => set('ctaLabel', e.target.value)}
          className={inputCls}
          placeholder="Get started"
        />
      </Field>
      <Field label="CTA URL">
        <input
          value={config.ctaHref ?? ''}
          onChange={(e) => set('ctaHref', e.target.value)}
          className={inputCls}
          placeholder="/contact"
        />
      </Field>
      <Field label="Secondary CTA Label">
        <input
          value={config.ctaSecondaryLabel ?? ''}
          onChange={(e) => set('ctaSecondaryLabel', e.target.value)}
          className={inputCls}
          placeholder="Learn more"
        />
      </Field>
      <Field label="Secondary CTA URL">
        <input
          value={config.ctaSecondaryHref ?? ''}
          onChange={(e) => set('ctaSecondaryHref', e.target.value)}
          className={inputCls}
          placeholder="/about"
        />
      </Field>
      <Field label="Variant">
        <select
          value={config.variant ?? 'default'}
          onChange={(e) =>
            set('variant', e.target.value as CtaBlockConfig['variant'])
          }
          className={inputCls}
        >
          <option value="default">Default</option>
          <option value="accent">Accent (orange)</option>
          <option value="dark">Dark</option>
        </select>
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function FeaturesGridEditor({
  config,
  onChange,
}: {
  config: FeaturesGridConfig;
  onChange: (c: FeaturesGridConfig) => void;
}) {
  const set = <K extends keyof FeaturesGridConfig>(k: K, v: FeaturesGridConfig[K]) =>
    onChange({ ...config, [k]: v });

  const items = config.items ?? [];

  function updateItem(
    idx: number,
    field: 'icon' | 'title' | 'description',
    val: string
  ) {
    const next = items.map((it, i) =>
      i === idx ? { ...it, [field]: val } : it
    );
    set('items', next);
  }

  function addItem() {
    set('items', [...items, { icon: '⭐', title: '', description: '' }]);
  }

  function removeItem(idx: number) {
    set('items', items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Heading">
          <input
            value={config.heading ?? ''}
            onChange={(e) => set('heading', e.target.value)}
            className={inputCls}
            placeholder="Why choose us"
          />
        </Field>
        <Field label="Columns">
          <select
            value={config.columns ?? 3}
            onChange={(e) =>
              set('columns', parseInt(e.target.value, 10) as 2 | 3 | 4)
            }
            className={inputCls}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Subheading">
            <input
              value={config.subheading ?? ''}
              onChange={(e) => set('subheading', e.target.value)}
              className={inputCls}
              placeholder="Short subtitle"
            />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Items ({items.length})
          </span>
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
          >
            + Add item
          </button>
        </div>
        {items.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <input
              value={item.icon ?? ''}
              onChange={(e) => updateItem(i, 'icon', e.target.value)}
              className="w-10 rounded border border-slate-200 bg-white p-1 text-center text-lg"
              placeholder="⭐"
            />
            <input
              value={item.title ?? ''}
              onChange={(e) => updateItem(i, 'title', e.target.value)}
              className={inputCls}
              placeholder="Title"
            />
            <input
              value={item.description ?? ''}
              onChange={(e) => updateItem(i, 'description', e.target.value)}
              className={`${inputCls} col-span-1`}
              placeholder="Description"
            />
            <div />
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function FaqEditor({
  config,
  onChange,
}: {
  config: FaqConfig;
  onChange: (c: FaqConfig) => void;
}) {
  const items = config.items ?? [];

  function updateItem(
    idx: number,
    field: 'question' | 'answer',
    val: string
  ) {
    const next = items.map((it, i) =>
      i === idx ? { ...it, [field]: val } : it
    );
    onChange({ ...config, items: next });
  }

  function addItem() {
    onChange({ ...config, items: [...items, { question: '', answer: '' }] });
  }

  function removeItem(idx: number) {
    onChange({ ...config, items: items.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-4">
      <Field label="Section Heading">
        <input
          value={config.heading ?? ''}
          onChange={(e) => onChange({ ...config, heading: e.target.value })}
          className={inputCls}
          placeholder="Frequently Asked Questions"
        />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Questions ({items.length})
          </span>
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
          >
            + Add question
          </button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-2 text-xs font-bold text-slate-400">Q{i + 1}</span>
              <input
                value={item.question ?? ''}
                onChange={(e) => updateItem(i, 'question', e.target.value)}
                className={`${inputCls} flex-1`}
                placeholder="Question text"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="mt-1.5 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
              >
                ✕
              </button>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-2 text-xs font-bold text-slate-400">A</span>
              <textarea
                value={item.answer ?? ''}
                onChange={(e) => updateItem(i, 'answer', e.target.value)}
                className={`${inputCls} flex-1`}
                rows={2}
                placeholder="Answer text"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function SpacerEditor({
  config,
  onChange,
}: {
  config: SpacerConfig;
  onChange: (c: SpacerConfig) => void;
}) {
  return (
    <Field label="Height">
      <select
        value={config.height ?? 'md'}
        onChange={(e) =>
          onChange({ height: e.target.value as SpacerConfig['height'] })
        }
        className={inputCls}
      >
        <option value="sm">Small (2rem)</option>
        <option value="md">Medium (4rem)</option>
        <option value="lg">Large (6rem)</option>
        <option value="xl">XL (8rem)</option>
      </select>
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* New section editors                                                         */
/* -------------------------------------------------------------------------- */

export function ProductGridEditor({
  config, onChange,
}: { config: ProductGridConfig; onChange: (c: ProductGridConfig) => void }) {
  const set = <K extends keyof ProductGridConfig>(k: K, v: ProductGridConfig[K]) =>
    onChange({ ...config, [k]: v });
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Heading"><input value={config.heading ?? ''} onChange={(e) => set('heading', e.target.value)} className={inputCls} placeholder="Featured Products" /></Field>
      <Field label="Source">
        <select value={config.source ?? 'latest'} onChange={(e) => set('source', e.target.value as ProductGridConfig['source'])} className={inputCls}>
          <option value="latest">Latest</option>
          <option value="featured">Featured</option>
          <option value="category">By Category</option>
        </select>
      </Field>
      {config.source === 'category' && (
        <Field label="Category Slug"><input value={config.categorySlug ?? ''} onChange={(e) => set('categorySlug', e.target.value)} className={inputCls} placeholder="electronics" /></Field>
      )}
      <Field label="Limit">
        <select value={config.limit ?? 8} onChange={(e) => set('limit', Number(e.target.value))} className={inputCls}>
          {[4, 6, 8, 12].map((n) => <option key={n} value={n}>{n} products</option>)}
        </select>
      </Field>
    </div>
  );
}

export function StatsEditor({
  config, onChange,
}: { config: StatsConfig; onChange: (c: StatsConfig) => void }) {
  const items = config.items ?? [];
  return (
    <div className="space-y-4">
      <Field label="Heading"><input value={config.heading ?? ''} onChange={(e) => onChange({ ...config, heading: e.target.value })} className={inputCls} placeholder="Our Numbers" /></Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Stats ({items.length})</span>
          <button type="button" onClick={() => onChange({ ...config, items: [...items, { value: '', label: '' }] })} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">+ Add</button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 p-2">
            <input value={item.value ?? ''} onChange={(e) => onChange({ ...config, items: items.map((it, j) => j === i ? { ...it, value: e.target.value } : it) })} className={inputCls} placeholder="1,000+" />
            <input value={item.label ?? ''} onChange={(e) => onChange({ ...config, items: items.map((it, j) => j === i ? { ...it, label: e.target.value } : it) })} className={inputCls} placeholder="Products" />
            <button type="button" onClick={() => onChange({ ...config, items: items.filter((_, j) => j !== i) })} className="rounded p-1 text-red-400 hover:bg-red-50">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrustSectionEditor({
  config, onChange,
}: { config: TrustSectionConfig; onChange: (c: TrustSectionConfig) => void }) {
  const items = config.items ?? [];
  return (
    <div className="space-y-4">
      <Field label="Heading"><input value={config.heading ?? ''} onChange={(e) => onChange({ ...config, heading: e.target.value })} className={inputCls} placeholder="Why trust us" /></Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Items ({items.length})</span>
          <button type="button" onClick={() => onChange({ ...config, items: [...items, { icon: '✓', title: '', description: '' }] })} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">+ Add</button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 rounded-xl border border-slate-200 p-2">
            <input value={item.icon ?? ''} onChange={(e) => onChange({ ...config, items: items.map((it, j) => j === i ? { ...it, icon: e.target.value } : it) })} className="w-10 rounded border border-slate-200 bg-white p-1 text-center text-lg" />
            <input value={item.title ?? ''} onChange={(e) => onChange({ ...config, items: items.map((it, j) => j === i ? { ...it, title: e.target.value } : it) })} className={inputCls} placeholder="Title" />
            <input value={item.description ?? ''} onChange={(e) => onChange({ ...config, items: items.map((it, j) => j === i ? { ...it, description: e.target.value } : it) })} className={inputCls} placeholder="Description" />
            <button type="button" onClick={() => onChange({ ...config, items: items.filter((_, j) => j !== i) })} className="rounded p-1 text-red-400 hover:bg-red-50">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SupplierShowcaseEditor({
  config, onChange,
}: { config: SupplierShowcaseConfig; onChange: (c: SupplierShowcaseConfig) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Heading"><input value={config.heading ?? ''} onChange={(e) => onChange({ ...config, heading: e.target.value })} className={inputCls} placeholder="Our Suppliers" /></Field>
      <Field label="Limit">
        <select value={config.limit ?? 6} onChange={(e) => onChange({ ...config, limit: Number(e.target.value) })} className={inputCls}>
          {[4, 6, 8, 12].map((n) => <option key={n} value={n}>{n} suppliers</option>)}
        </select>
      </Field>
    </div>
  );
}

export function BlogPostsEditor({
  config, onChange,
}: { config: BlogPostsConfig; onChange: (c: BlogPostsConfig) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Heading"><input value={config.heading ?? ''} onChange={(e) => onChange({ ...config, heading: e.target.value })} className={inputCls} placeholder="Latest Posts" /></Field>
      <Field label="Limit">
        <select value={config.limit ?? 3} onChange={(e) => onChange({ ...config, limit: Number(e.target.value) })} className={inputCls}>
          {[3, 4, 6].map((n) => <option key={n} value={n}>{n} posts</option>)}
        </select>
      </Field>
    </div>
  );
}

export function AuctionShowcaseEditor({
  config, onChange,
}: { config: AuctionShowcaseConfig; onChange: (c: AuctionShowcaseConfig) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Heading"><input value={config.heading ?? ''} onChange={(e) => onChange({ ...config, heading: e.target.value })} className={inputCls} placeholder="Live Auctions" /></Field>
      <Field label="Status">
        <select value={config.status ?? 'active'} onChange={(e) => onChange({ ...config, status: e.target.value as AuctionShowcaseConfig['status'] })} className={inputCls}>
          <option value="active">Active only</option>
          <option value="upcoming">Upcoming</option>
          <option value="all">All</option>
        </select>
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dispatcher                                                                  */
/* -------------------------------------------------------------------------- */

export function SectionConfigEditor({
  type,
  config,
  onChange,
  dir,
}: {
  type: string;
  config: SectionConfig;
  onChange: (c: SectionConfig) => void;
  dir?: 'ltr' | 'rtl';
}) {
  switch (type) {
    case 'HERO':
      return <HeroEditor config={config as HeroConfig} onChange={onChange} />;
    case 'RICH_TEXT':
      return <RichTextEditorSection config={config as RichTextConfig} onChange={onChange} dir={dir} />;
    case 'IMAGE_BANNER':
      return <ImageBannerEditor config={config as ImageBannerConfig} onChange={onChange} />;
    case 'CTA_BLOCK':
      return <CtaBlockEditor config={config as CtaBlockConfig} onChange={onChange} />;
    case 'FEATURES_GRID':
      return <FeaturesGridEditor config={config as FeaturesGridConfig} onChange={onChange} />;
    case 'FAQ':
      return <FaqEditor config={config as FaqConfig} onChange={onChange} />;
    case 'SPACER':
      return <SpacerEditor config={config as SpacerConfig} onChange={onChange} />;
    case 'PRODUCT_GRID':
      return <ProductGridEditor config={config as ProductGridConfig} onChange={onChange} />;
    case 'STATS':
      return <StatsEditor config={config as StatsConfig} onChange={onChange} />;
    case 'TRUST_SECTION':
      return <TrustSectionEditor config={config as TrustSectionConfig} onChange={onChange} />;
    case 'SUPPLIER_SHOWCASE':
      return <SupplierShowcaseEditor config={config as SupplierShowcaseConfig} onChange={onChange} />;
    case 'BLOG_POSTS':
      return <BlogPostsEditor config={config as BlogPostsConfig} onChange={onChange} />;
    case 'AUCTION_SHOWCASE':
      return <AuctionShowcaseEditor config={config as AuctionShowcaseConfig} onChange={onChange} />;
    default:
      return <p className="text-sm text-slate-400">Unknown section type: {type}</p>;
  }
}
