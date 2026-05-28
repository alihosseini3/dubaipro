'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

import {
  FormMessage,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  Toggle
} from './AdminForm';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { MultiImageUpload } from '@/components/ui/MultiImageUpload';
import type { CategoryAttributeDTO } from '@/lib/attributes/service';

type Option = { id: string; name: string; slug?: string };

type ProductFormValues = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  stock: number;
  isB2B: boolean;
  categoryId: string;
  brandId: string;
  supplierId: string;
  imageUrl: string | null;
  images: string[];
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  shippingClass: string;
  metaTitle: string;
  metaDescription: string;
};

type ProductFormProps = {
  initial?: Partial<ProductFormValues>;
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
  locale: string;
  initialAttrValues?: Record<string, string>;
};

function toCatFolder(slug: string | undefined): string {
  if (!slug) return 'products';
  return `cat-${slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)}`;
}

const emptyValues: ProductFormValues = {
  title: '',
  slug: '',
  description: '',
  price: 0,
  compareAtPrice: null,
  currency: 'USD',
  stock: 0,
  isB2B: false,
  categoryId: '',
  brandId: '',
  supplierId: '',
  imageUrl: null,
  images: [],
  weight: null,
  length: null,
  width: null,
  height: null,
  shippingClass: 'normal',
  metaTitle: '',
  metaDescription: ''
};

export function ProductForm({ initial, categories, brands, suppliers, locale, initialAttrValues }: ProductFormProps) {
  const t = useTranslations('admin.products');
  const tCommon = useTranslations('admin.common');
  const tUpload = useTranslations('upload');
  const currentLocale = useLocale();
  const router = useRouter();

  const [values, setValues] = useState<ProductFormValues>({
    ...emptyValues,
    ...initial,
    categoryId: initial?.categoryId ?? categories[0]?.id ?? '',
    supplierId: initial?.supplierId ?? suppliers[0]?.id ?? '',
    images: Array.isArray(initial?.images) ? initial!.images! : []
  });
  const [pending, setPending] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);

  const selectedCategorySlug = categories.find((c) => c.id === values.categoryId)?.slug;
  const galleryFolder = toCatFolder(selectedCategorySlug);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [categoryAttrs, setCategoryAttrs] = useState<CategoryAttributeDTO[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>(initialAttrValues ?? {});
  const [attrsLoading, setAttrsLoading] = useState(false);

  const isEdit = Boolean(values.id);

  useEffect(() => {
    if (!values.categoryId) {
      setCategoryAttrs([]);
      return;
    }
    setAttrsLoading(true);
    fetch(`/api/admin/categories/${values.categoryId}/attributes`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json: { data?: CategoryAttributeDTO[] }) => {
        setCategoryAttrs(json.data ?? []);
      })
      .catch(() => setCategoryAttrs([]))
      .finally(() => setAttrsLoading(false));
  }, [values.categoryId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!values.title.trim() || !values.categoryId || !values.supplierId) {
      setError(tCommon('validationError'));
      return;
    }

    setPending(true);
    try {
      const endpoint = isEdit ? `/api/products/${values.id}` : '/api/products';
      const method = isEdit ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = {
        title: values.title.trim(),
        description: values.description,
        price: Number(values.price),
        compareAtPrice: values.compareAtPrice != null && values.compareAtPrice > 0 ? Number(values.compareAtPrice) : null,
        currency: values.currency.trim().toUpperCase(),
        stock: Math.trunc(Number(values.stock)),
        isB2B: values.isB2B,
        categoryId: values.categoryId,
        supplierId: values.supplierId,
        brandId: values.brandId || null,
        imageUrl: values.imageUrl,
        images: values.images,
        weight: values.weight === null || values.weight === undefined ? null : Number(values.weight),
        length: values.length === null || values.length === undefined ? null : Number(values.length),
        width: values.width === null || values.width === undefined ? null : Number(values.width),
        height: values.height === null || values.height === undefined ? null : Number(values.height),
        shippingClass: values.shippingClass.trim() || null,
        metaTitle: values.metaTitle.trim() || null,
        metaDescription: values.metaDescription.trim() || null,
        attributeValues: attrValues,
      };
      if (values.slug.trim()) body.slug = values.slug.trim();

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `status ${res.status}`);
      }

      setSuccess(isEdit ? t('updateSuccess') : t('createSuccess'));
      router.refresh();
      if (!isEdit) {
        const json = (await res.json()) as { data?: { id: string } };
        if (json.data?.id) router.push(`/${locale}/admin/products/${json.data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('saveFailed'));
    } finally {
      setPending(false);
    }
  }

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function updateAttr(slug: string, value: string) {
    setAttrValues((prev) => ({ ...prev, [slug]: value }));
  }

  function resolveAttrName(attr: CategoryAttributeDTO): string {
    if (attr.nameTranslations) {
      return attr.nameTranslations[currentLocale] ?? attr.nameTranslations['en'] ?? attr.name;
    }
    return attr.name;
  }

  const categoryOptions = [{ value: '', label: t('noCategory') }, ...categories.map((c) => ({ value: c.id, label: c.name }))];
  const brandOptions = [{ value: '', label: t('noBrand') }, ...brands.map((b) => ({ value: b.id, label: b.name }))];
  const supplierOptions = [{ value: '', label: t('noSupplier') }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <FormMessage type="error">{error}</FormMessage>}
      {success && <FormMessage type="success">{success}</FormMessage>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput
          name="title"
          label={t('fieldTitle')}
          required
          value={values.title}
          onChange={(e) => update('title', e.target.value)}
        />
        <TextInput
          name="slug"
          label={t('fieldSlug')}
          hint={t('fieldSlugHint')}
          value={values.slug}
          onChange={(e) => update('slug', e.target.value)}
        />
      </div>

      <TextArea
        name="description"
        label={t('fieldDescription')}
        rows={5}
        value={values.description}
        onChange={(e) => update('description', e.target.value)}
      />

      <ImageUpload
        value={values.imageUrl}
        onChange={(url) => update('imageUrl', url)}
        onUploadingChange={setCoverUploading}
        label={tUpload('coverLabel')}
        hint={tUpload('coverHint')}
        galleryFolder={galleryFolder}
        uploadFolder={galleryFolder}
      />

      <MultiImageUpload
        value={values.images}
        onChange={(urls) => update('images', urls)}
        onUploadingChange={setGalleryUploading}
        label={tUpload('galleryLabel')}
        hint={tUpload('galleryHint')}
        galleryFolder={galleryFolder}
        uploadFolder={galleryFolder}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <TextInput
          name="price"
          type="number"
          step="0.01"
          min={0}
          label={t('fieldPrice')}
          required
          value={values.price}
          onChange={(e) => update('price', Number(e.target.value))}
        />
        <TextInput
          name="compareAtPrice"
          type="number"
          step="0.01"
          min={0}
          label="Compare At Price"
          placeholder="Original price (optional)"
          value={values.compareAtPrice ?? ''}
          onChange={(e) => update('compareAtPrice', e.target.value === '' ? null : Number(e.target.value))}
        />
        <TextInput
          name="currency"
          label={t('fieldCurrency')}
          maxLength={3}
          value={values.currency}
          onChange={(e) => update('currency', e.target.value)}
        />
        <TextInput
          name="stock"
          type="number"
          min={0}
          step={1}
          label={t('fieldStock')}
          value={values.stock}
          onChange={(e) => update('stock', Number(e.target.value))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Select
          name="categoryId"
          label={t('fieldCategory')}
          required
          value={values.categoryId}
          onChange={(e) => {
            update('categoryId', e.target.value);
            setAttrValues({});
          }}
          options={categoryOptions}
        />
        <Select
          name="brandId"
          label={t('fieldBrand')}
          value={values.brandId}
          onChange={(e) => update('brandId', e.target.value)}
          options={brandOptions}
        />
        <Select
          name="supplierId"
          label={t('fieldSupplier')}
          required
          value={values.supplierId}
          onChange={(e) => update('supplierId', e.target.value)}
          options={supplierOptions}
        />
      </div>

      {/* Dynamic category attributes */}
      <fieldset className="rounded-lg border border-dashed border-orange-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-orange-600">
          {t('attributesTitle')}
        </legend>
        <p className="mb-3 text-xs text-slate-500">{t('attributesHint')}</p>
        {!values.categoryId ? (
          <p className="text-xs text-slate-400 italic">{t('attributesEmpty')}</p>
        ) : attrsLoading ? (
          <p className="text-xs text-slate-400">{tCommon('loading')}</p>
        ) : categoryAttrs.length === 0 ? (
          <p className="text-xs text-slate-400 italic">{t('attributesNone')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categoryAttrs.map((attr) => {
              const attrLabel = resolveAttrName(attr);
              const labelWithUnit = attr.unit ? `${attrLabel} (${attr.unit})` : attrLabel;
              const val = attrValues[attr.slug] ?? '';

              if (attr.type === 'boolean') {
                return (
                  <div key={attr.slug} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">{labelWithUnit}</span>
                    <button
                      type="button"
                      onClick={() => updateAttr(attr.slug, val === 'true' ? 'false' : 'true')}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        val === 'true' ? 'bg-orange-500' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          val === 'true' ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              }

              if (attr.type === 'select' && attr.options && attr.options.length > 0) {
                return (
                  <div key={attr.slug}>
                    <label className="mb-1 block text-xs font-medium text-slate-700">{labelWithUnit}</label>
                    <select
                      value={val}
                      onChange={(e) => updateAttr(attr.slug, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    >
                      <option value="">—</option>
                      {attr.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (attr.type === 'color') {
                return (
                  <div key={attr.slug}>
                    <label className="mb-1 block text-xs font-medium text-slate-700">{labelWithUnit}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={val.startsWith('#') ? val : '#000000'}
                        onChange={(e) => updateAttr(attr.slug, e.target.value)}
                        className="h-9 w-9 cursor-pointer rounded border border-slate-200 p-0.5"
                      />
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => updateAttr(attr.slug, e.target.value)}
                        placeholder="#000000 or color name"
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>
                );
              }

              // number or select with no options — free text / number input
              return (
                <div key={attr.slug}>
                  <label className="mb-1 block text-xs font-medium text-slate-700">{labelWithUnit}</label>
                  <input
                    type={attr.type === 'number' ? 'number' : 'text'}
                    value={val}
                    onChange={(e) => updateAttr(attr.slug, e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              );
            })}
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-lg border border-dashed border-slate-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {t('shippingTitle')}
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextInput
            name="weight"
            type="number"
            min={0}
            step={0.01}
            label={t('fieldWeight')}
            value={values.weight ?? ''}
            onChange={(e) =>
              update('weight', e.target.value === '' ? null : Number(e.target.value))
            }
          />
          <TextInput
            name="length"
            type="number"
            min={0}
            step={0.1}
            label={t('fieldLength')}
            value={values.length ?? ''}
            onChange={(e) =>
              update('length', e.target.value === '' ? null : Number(e.target.value))
            }
          />
          <TextInput
            name="width"
            type="number"
            min={0}
            step={0.1}
            label={t('fieldWidth')}
            value={values.width ?? ''}
            onChange={(e) =>
              update('width', e.target.value === '' ? null : Number(e.target.value))
            }
          />
          <TextInput
            name="height"
            type="number"
            min={0}
            step={0.1}
            label={t('fieldHeight')}
            value={values.height ?? ''}
            onChange={(e) =>
              update('height', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </div>
        <div className="mt-3">
          <TextInput
            name="shippingClass"
            label={t('fieldShippingClass')}
            value={values.shippingClass}
            onChange={(e) => update('shippingClass', e.target.value)}
            placeholder="normal / fragile / heavy"
          />
        </div>
      </fieldset>

      <Toggle
        label={t('fieldIsB2B')}
        description={t('fieldIsB2BDescription')}
        checked={values.isB2B}
        onChange={(v) => update('isB2B', v)}
      />

      <fieldset className="rounded-lg border border-dashed border-slate-200 p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {t('seoTitle')}
        </legend>
        <p className="mb-3 text-xs text-slate-500">{t('seoHint')}</p>
        <div className="space-y-3">
          <TextInput
            name="metaTitle"
            label={t('fieldMetaTitle')}
            hint={t('fieldMetaTitleHint')}
            maxLength={70}
            value={values.metaTitle}
            onChange={(e) => update('metaTitle', e.target.value)}
          />
          <TextArea
            name="metaDescription"
            label={t('fieldMetaDescription')}
            hint={t('fieldMetaDescriptionHint')}
            rows={3}
            maxLength={200}
            value={values.metaDescription}
            onChange={(e) => update('metaDescription', e.target.value)}
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton
          label={isEdit ? tCommon('update') : tCommon('create')}
          pendingLabel={isEdit ? tCommon('updating') : tCommon('creating')}
          pending={pending}
          disabled={coverUploading || galleryUploading}
        />
        {(coverUploading || galleryUploading) && (
          <span className="text-xs font-medium text-slate-500">
            {tUpload('uploading')}
          </span>
        )}
      </div>
    </form>
  );
}
