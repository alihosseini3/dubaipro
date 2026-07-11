'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useApiMutation } from '@/hooks/use-api';

const CURRENCIES = ['USD', 'AED', 'IRR', 'EUR', 'CNY'] as const;

type Category = { id: string; name: string };

type CreatedProduct = { data: { id: string } };

export function ProductCreateForm({
  locale,
  categories
}: {
  locale: string;
  categories: Category[];
}) {
  const t = useTranslations('supplier.products');
  const router = useRouter();
  const create = useApiMutation<Record<string, unknown>, CreatedProduct>(
    '/api/supplier/products',
    'POST'
  );

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<string>('USD');
  const [moq, setMoq] = useState('1');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await create.mutate({
        title: title.trim(),
        categoryId,
        description: description.trim(),
        price: Number(price),
        currency,
        moq: Math.max(1, Number(moq) || 1)
      });
      router.push(`/${locale}/supplier/products/${result.data.id}/edit`);
    } catch {
      /* create.error rendered below */
    }
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
    >
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('fieldTitle')}
        </span>
        <input
          required
          minLength={3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`mt-1 ${field}`}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('fieldCategory')}
        </span>
        <select
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`mt-1 ${field}`}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('fieldDescription')}
        </span>
        <textarea
          required
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`mt-1 ${field}`}
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('fieldPrice')}
          </span>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`mt-1 ${field}`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('fieldCurrency')}
          </span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={`mt-1 ${field}`}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('fieldMoq')}
          </span>
          <input
            type="number"
            min="1"
            value={moq}
            onChange={(e) => setMoq(e.target.value)}
            className={`mt-1 ${field}`}
          />
        </label>
      </div>

      {create.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {create.error.message}
          {create.error.details && (
            <span className="mt-1 block text-xs">
              {Object.entries(create.error.details)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </span>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={create.loading}
        className="w-full rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
      >
        {create.loading ? t('creating') : t('createAndContinue')}
      </button>
    </form>
  );
}
