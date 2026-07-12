'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';

const CURRENCIES = ['USD', 'AED', 'IRR', 'EUR', 'CNY'] as const;

type Category = { id: string; name: string };

type Tier = {
  id?: string;
  currency: string;
  minQty: number;
  maxQty: number | null;
  unitPrice: number;
  leadTimeDays: number | null;
};

type Variant = {
  id?: string;
  sku: string | null;
  name: string;
  options: Record<string, string>;
  unitPrice: number | null;
  moq: number | null;
  stock: number;
  imageUrl: string | null;
  isActive: boolean;
};

type ProductPayload = {
  data: {
    id: string;
    title: string;
    slug: string;
    description: string;
    price: string;
    currency: string;
    stock: number;
    status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
    isPublished: boolean;
    submittedAt: string | null;
    rejectionReason: string | null;
    categoryId: string;
    moq: number | null;
    moqUnit: string | null;
    samplePrice: string | null;
    tradeTerms: string | null;
    originCountry: string | null;
    leadTimeDays: number | null;
    warrantyYears: number | null;
    metaTitle: string | null;
    metaDescription: string | null;
    priceTiers: Tier[];
    variants: Variant[];
  };
};

type Tab = 'info' | 'tiers' | 'variants' | 'status';

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  ARCHIVED: 'bg-slate-200 text-slate-500'
};

const FIELD =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white';

export function ProductEditor({
  locale,
  productId,
  categories,
  canSubmit
}: {
  locale: string;
  productId: string;
  categories: Category[];
  /** False until the admin approves the supplier's application. Drafting stays
   *  open; only the hand-off to the review queue is gated (server enforces it). */
  canSubmit: boolean;
}) {
  const t = useTranslations('supplier.products');
  const [tab, setTab] = useState<Tab>('info');
  const [notice, setNotice] = useState<string | null>(null);

  const productQuery = useApiQuery<ProductPayload>(
    `/api/supplier/products/${productId}`
  );

  const save = useApiMutation<Record<string, unknown>, ProductPayload>(
    `/api/supplier/products/${productId}`,
    'PATCH'
  );
  const saveTiers = useApiMutation<{ tiers: Tier[] }, unknown>(
    `/api/supplier/products/${productId}/tiers`,
    'PUT'
  );
  const saveVariants = useApiMutation<{ variants: Omit<Variant, 'id'>[] }, unknown>(
    `/api/supplier/products/${productId}/variants`,
    'PUT'
  );
  const statusAction = useApiMutation<
    { action: 'submit' | 'archive' | 'unarchive' },
    unknown
  >(`/api/supplier/products/${productId}/status`, 'POST');

  /* Local editable state, hydrated from the fetch */
  const [info, setInfo] = useState<Record<string, string>>({});
  const [isPublished, setIsPublished] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const product = productQuery.data?.data;

  useEffect(() => {
    if (!product || hydrated) return;
    setInfo({
      title: product.title,
      categoryId: product.categoryId,
      description: product.description,
      price: String(product.price),
      currency: product.currency,
      stock: String(product.stock),
      moq: String(product.moq ?? 1),
      moqUnit: product.moqUnit ?? 'pieces',
      samplePrice: product.samplePrice ? String(product.samplePrice) : '',
      tradeTerms: product.tradeTerms ?? '',
      originCountry: product.originCountry ?? '',
      leadTimeDays: product.leadTimeDays != null ? String(product.leadTimeDays) : '',
      warrantyYears: product.warrantyYears != null ? String(product.warrantyYears) : '',
      metaTitle: product.metaTitle ?? '',
      metaDescription: product.metaDescription ?? ''
    });
    setIsPublished(product.isPublished);
    setTiers(
      product.priceTiers.map((tier) => ({ ...tier, unitPrice: Number(tier.unitPrice) }))
    );
    setVariants(
      product.variants.map((v) => ({
        ...v,
        unitPrice: v.unitPrice != null ? Number(v.unitPrice) : null
      }))
    );
    setHydrated(true);
  }, [product, hydrated]);

  if (productQuery.loading && !product) {
    return <p className="text-sm text-slate-500">{t('loading')}</p>;
  }
  if (productQuery.error || !product) {
    return (
      <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {productQuery.error?.message ?? t('notFound')}
      </p>
    );
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setInfo((prev) => ({ ...prev, [key]: e.target.value }));

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      await save.mutate({
        title: info.title.trim(),
        categoryId: info.categoryId,
        description: info.description.trim(),
        price: Number(info.price),
        currency: info.currency,
        stock: Math.max(0, Number(info.stock) || 0),
        isPublished,
        moq: Math.max(1, Number(info.moq) || 1),
        moqUnit: info.moqUnit.trim() || 'pieces',
        samplePrice: num(info.samplePrice),
        tradeTerms: info.tradeTerms.trim() || null,
        originCountry: info.originCountry.trim() || null,
        leadTimeDays: num(info.leadTimeDays),
        warrantyYears: num(info.warrantyYears),
        metaTitle: info.metaTitle.trim() || null,
        metaDescription: info.metaDescription.trim() || null
      });
      setNotice(t('saved'));
      productQuery.refetch();
    } catch {
      /* save.error rendered below */
    }
  }

  async function handleSaveTiers() {
    setNotice(null);
    try {
      await saveTiers.mutate({
        tiers: tiers.map((tier) => ({
          currency: tier.currency,
          minQty: tier.minQty,
          maxQty: tier.maxQty,
          unitPrice: tier.unitPrice,
          leadTimeDays: tier.leadTimeDays
        }))
      });
      setNotice(t('saved'));
      productQuery.refetch();
    } catch {
      /* saveTiers.error rendered below */
    }
  }

  async function handleSaveVariants() {
    setNotice(null);
    try {
      await saveVariants.mutate({
        variants: variants.map(({ id: _id, ...v }) => ({
          ...v,
          sku: v.sku?.trim() || null,
          name: v.name.trim(),
          imageUrl: v.imageUrl?.trim() || null
        }))
      });
      setNotice(t('saved'));
      productQuery.refetch();
    } catch {
      /* saveVariants.error rendered below */
    }
  }

  async function handleStatus(action: 'submit' | 'archive' | 'unarchive') {
    setNotice(null);
    try {
      await statusAction.mutate({ action });
      setNotice(t('saved'));
      productQuery.refetch();
    } catch {
      /* statusAction.error rendered below */
    }
  }

  const activeError =
    save.error ?? saveTiers.error ?? saveVariants.error ?? statusAction.error;

  const statusLabel = (s: string) => t(`status.${s}` as Parameters<typeof t>[0]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: t('tabInfo') },
    { key: 'tiers', label: t('tabTiers') },
    { key: 'variants', label: t('tabVariants') },
    { key: 'status', label: t('tabStatus') }
  ];

  return (
    <div className="space-y-4">
      {/* Header strip: title + status badge */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {product.title}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_TONE[product.status]}`}
        >
          {statusLabel(product.status)}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? 'bg-orange-500 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && <p className="text-sm text-emerald-600">{notice}</p>}
      {activeError && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {activeError.message}
          {activeError.details && (
            <span className="mt-1 block text-xs">
              {Object.entries(activeError.details)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </span>
          )}
        </p>
      )}

      {/* ── Info tab ── */}
      {tab === 'info' && (
        <form
          onSubmit={handleSaveInfo}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">{t('fieldTitle')}</span>
              <input required value={info.title ?? ''} onChange={set('title')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldCategory')}</span>
              <select value={info.categoryId ?? ''} onChange={set('categoryId')} className={`mt-1 ${FIELD}`}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldOrigin')}</span>
              <input value={info.originCountry ?? ''} onChange={set('originCountry')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">{t('fieldDescription')}</span>
              <textarea required rows={5} value={info.description ?? ''} onChange={set('description')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldPrice')}</span>
              <input required type="number" min="0.01" step="0.01" value={info.price ?? ''} onChange={set('price')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldCurrency')}</span>
              <select value={info.currency ?? 'USD'} onChange={set('currency')} className={`mt-1 ${FIELD}`}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldStock')}</span>
              <input type="number" min="0" value={info.stock ?? '0'} onChange={set('stock')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldMoq')}</span>
              <input type="number" min="1" value={info.moq ?? '1'} onChange={set('moq')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldMoqUnit')}</span>
              <input value={info.moqUnit ?? ''} onChange={set('moqUnit')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldSamplePrice')}</span>
              <input type="number" min="0.01" step="0.01" value={info.samplePrice ?? ''} onChange={set('samplePrice')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldTradeTerms')}</span>
              <input placeholder="FOB / CIF / EXW / DDP" value={info.tradeTerms ?? ''} onChange={set('tradeTerms')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldLeadTime')}</span>
              <input type="number" min="0" value={info.leadTimeDays ?? ''} onChange={set('leadTimeDays')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">{t('fieldWarranty')}</span>
              <input type="number" min="0" value={info.warrantyYears ?? ''} onChange={set('warrantyYears')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">{t('fieldMetaTitle')}</span>
              <input maxLength={70} value={info.metaTitle ?? ''} onChange={set('metaTitle')} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">{t('fieldMetaDescription')}</span>
              <textarea rows={2} maxLength={200} value={info.metaDescription ?? ''} onChange={set('metaDescription')} className={`mt-1 ${FIELD}`} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-orange-500"
            />
            <span>{t('publishSwitch')}</span>
          </label>
          <p className="text-xs text-slate-400">{t('publishHint')}</p>

          <button
            type="submit"
            disabled={save.loading}
            className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {save.loading ? t('saving') : t('save')}
          </button>
        </form>
      )}

      {/* ── Tiers tab ── */}
      {tab === 'tiers' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-sm text-slate-500">{t('tiersHint')}</p>
          <div className="space-y-2">
            {tiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
                <label className="block">
                  <span className="text-xs text-slate-500">{t('tierCurrency')}</span>
                  <select
                    value={tier.currency}
                    onChange={(e) =>
                      setTiers((prev) => prev.map((x, i) => (i === index ? { ...x, currency: e.target.value } : x)))
                    }
                    className={`mt-0.5 ${FIELD}`}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">{t('tierMinQty')}</span>
                  <input
                    type="number" min="1" value={tier.minQty}
                    onChange={(e) =>
                      setTiers((prev) => prev.map((x, i) => (i === index ? { ...x, minQty: Number(e.target.value) } : x)))
                    }
                    className={`mt-0.5 ${FIELD}`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">{t('tierMaxQty')}</span>
                  <input
                    type="number" min="1" placeholder="∞" value={tier.maxQty ?? ''}
                    onChange={(e) =>
                      setTiers((prev) => prev.map((x, i) => (i === index ? { ...x, maxQty: e.target.value === '' ? null : Number(e.target.value) } : x)))
                    }
                    className={`mt-0.5 ${FIELD}`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">{t('tierUnitPrice')}</span>
                  <input
                    type="number" min="0.01" step="0.01" value={tier.unitPrice || ''}
                    onChange={(e) =>
                      setTiers((prev) => prev.map((x, i) => (i === index ? { ...x, unitPrice: Number(e.target.value) } : x)))
                    }
                    className={`mt-0.5 ${FIELD}`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">{t('tierLeadTime')}</span>
                  <input
                    type="number" min="0" value={tier.leadTimeDays ?? ''}
                    onChange={(e) =>
                      setTiers((prev) => prev.map((x, i) => (i === index ? { ...x, leadTimeDays: e.target.value === '' ? null : Number(e.target.value) } : x)))
                    }
                    className={`mt-0.5 ${FIELD}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}
                  className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  {t('remove')}
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setTiers((prev) => [
                  ...prev,
                  {
                    currency: info.currency ?? 'USD',
                    minQty: prev.length > 0 ? (prev[prev.length - 1].maxQty ?? prev[prev.length - 1].minQty * 10) + 1 : 1,
                    maxQty: null,
                    unitPrice: 0,
                    leadTimeDays: null
                  }
                ])
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200"
            >
              + {t('addTier')}
            </button>
            <button
              type="button"
              disabled={saveTiers.loading}
              onClick={handleSaveTiers}
              className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saveTiers.loading ? t('saving') : t('saveTiers')}
            </button>
          </div>
        </div>
      )}

      {/* ── Variants tab ── */}
      {tab === 'variants' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-sm text-slate-500">{t('variantsHint')}</p>
          <div className="space-y-3">
            {variants.map((variant, index) => (
              <div key={index} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-slate-500">{t('variantName')}</span>
                    <input
                      value={variant.name}
                      onChange={(e) =>
                        setVariants((prev) => prev.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)))
                      }
                      placeholder="Red / XL"
                      className={`mt-0.5 ${FIELD}`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">SKU</span>
                    <input
                      value={variant.sku ?? ''}
                      onChange={(e) =>
                        setVariants((prev) => prev.map((x, i) => (i === index ? { ...x, sku: e.target.value || null } : x)))
                      }
                      className={`mt-0.5 ${FIELD}`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">{t('variantPrice')}</span>
                    <input
                      type="number" min="0.01" step="0.01"
                      placeholder={t('inherit')}
                      value={variant.unitPrice ?? ''}
                      onChange={(e) =>
                        setVariants((prev) => prev.map((x, i) => (i === index ? { ...x, unitPrice: e.target.value === '' ? null : Number(e.target.value) } : x)))
                      }
                      className={`mt-0.5 ${FIELD}`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">{t('variantStock')}</span>
                    <input
                      type="number" min="0" value={variant.stock}
                      onChange={(e) =>
                        setVariants((prev) => prev.map((x, i) => (i === index ? { ...x, stock: Number(e.target.value) || 0 } : x)))
                      }
                      className={`mt-0.5 ${FIELD}`}
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={variant.isActive}
                        onChange={(e) =>
                          setVariants((prev) => prev.map((x, i) => (i === index ? { ...x, isActive: e.target.checked } : x)))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-orange-500"
                      />
                      {t('active')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setVariants((prev) => prev.filter((_, i) => i !== index))}
                      className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      {t('remove')}
                    </button>
                  </div>
                </div>
                <label className="mt-2 block">
                  <span className="text-xs text-slate-500">{t('variantOptions')}</span>
                  <input
                    value={Object.entries(variant.options)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ')}
                    onChange={(e) => {
                      const options: Record<string, string> = {};
                      for (const pair of e.target.value.split(',')) {
                        const [k, ...rest] = pair.split('=');
                        if (k?.trim() && rest.length > 0) options[k.trim()] = rest.join('=').trim();
                      }
                      setVariants((prev) => prev.map((x, i) => (i === index ? { ...x, options } : x)));
                    }}
                    placeholder="Color=Red, Size=XL"
                    className={`mt-0.5 ${FIELD}`}
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setVariants((prev) => [
                  ...prev,
                  { sku: null, name: '', options: {}, unitPrice: null, moq: null, stock: 0, imageUrl: null, isActive: true }
                ])
              }
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200"
            >
              + {t('addVariant')}
            </button>
            <button
              type="button"
              disabled={saveVariants.loading}
              onClick={handleSaveVariants}
              className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saveVariants.loading ? t('saving') : t('saveVariants')}
            </button>
          </div>
        </div>
      )}

      {/* ── Status tab ── */}
      {tab === 'status' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${STATUS_TONE[product.status]}`}
            >
              {statusLabel(product.status)}
            </span>
            {product.submittedAt && product.status === 'PENDING_REVIEW' && (
              <span className="text-xs text-slate-400">
                {t('submittedAt', {
                  date: new Date(product.submittedAt).toLocaleString(locale)
                })}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-500">
            {t(`statusHelp.${product.status}` as Parameters<typeof t>[0])}
          </p>

          {product.status === 'REJECTED' && product.rejectionReason && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30">
              <span className="font-semibold">{t('rejectionReason')}:</span>{' '}
              {product.rejectionReason}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {(product.status === 'DRAFT' || product.status === 'REJECTED') && (
              <>
                <button
                  type="button"
                  disabled={statusAction.loading || !canSubmit}
                  onClick={() => handleStatus('submit')}
                  className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                  title={canSubmit ? undefined : t('submitLockedHint')}
                >
                  {t('submitForReview')}
                </button>
                {!canSubmit && (
                  <span className="text-xs font-medium text-amber-600">
                    {t('submitLockedHint')}
                  </span>
                )}
              </>
            )}
            {product.status !== 'ARCHIVED' && (
              <button
                type="button"
                disabled={statusAction.loading}
                onClick={() => handleStatus('archive')}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300"
              >
                {t('archive')}
              </button>
            )}
            {product.status === 'ARCHIVED' && (
              <button
                type="button"
                disabled={statusAction.loading}
                onClick={() => handleStatus('unarchive')}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300"
              >
                {t('unarchive')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
