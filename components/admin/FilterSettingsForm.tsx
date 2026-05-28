'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { TextInput, Toggle, SubmitButton, FormMessage } from '@/components/admin/AdminForm';
import type { FilterSettingsDTO } from '@/lib/filters/settings-shared';

type Props = { initial: FilterSettingsDTO };

export function FilterSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FilterSettingsDTO>(initial);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function setField<K extends keyof FilterSettingsDTO>(key: K, value: FilterSettingsDTO[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/settings/filters', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ type: 'error', text: json.issues?.join(', ') ?? json.error ?? 'Save failed' });
      } else {
        setMsg({ type: 'success', text: 'Filter settings saved.' });
        router.refresh();
      }
    } catch {
      setMsg({ type: 'error', text: 'Network error — please try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Visibility ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h3 className="text-sm font-semibold text-slate-900">Visible filter sections</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Toggle each section on or off. Changes apply on all category and product listing pages.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              { key: 'showSearchFilter',      label: 'Search box',       desc: 'Free-text search inside the panel' },
              { key: 'showPriceFilter',        label: 'Price Range',      desc: 'Dual-thumb price slider' },
              { key: 'showRatingFilter',       label: 'Rating',           desc: '★4+ / ★3+ quick-filter rows' },
              { key: 'showInStockFilter',      label: 'In Stock Only',    desc: 'Availability checkbox' },
              { key: 'showB2BFilter',          label: 'Wholesale / B2B',  desc: 'B2B-only toggle' },
              { key: 'showDiscountFilter',     label: 'Deals',            desc: 'Products with active coupon/promo' },
              { key: 'showNewArrivalsFilter',  label: 'New Arrivals',     desc: 'Products added in the last 30 days' },
              { key: 'showBrandFilter',        label: 'Brand',            desc: 'Multi-select brand list' },
              { key: 'showSupplierFilter',     label: 'Supplier',         desc: 'Multi-select supplier list' },
            ] as const
          ).map(({ key, label, desc }) => (
            <div key={key} className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
              form[key] ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'
            }`}>
              <button
                type="button"
                role="switch"
                aria-checked={form[key]}
                onClick={() => setField(key, !form[key])}
                className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  form[key] ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form[key] ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <div>
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Custom labels ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h3 className="text-sm font-semibold text-slate-900">Section labels</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Rename filter sections for your audience. Max 60 characters.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(
            [
              { key: 'searchLabel',       label: 'Search label',       placeholder: 'Search products' },
              { key: 'priceLabel',         label: 'Price Range label',  placeholder: 'Price Range' },
              { key: 'ratingLabel',        label: 'Rating label',       placeholder: 'Rating' },
              { key: 'availabilityLabel',  label: 'Availability label', placeholder: 'Availability' },
              { key: 'discountLabel',      label: 'Deals label',        placeholder: 'Deals' },
              { key: 'newArrivalsLabel',   label: 'New Arrivals label', placeholder: 'New Arrivals' },
              { key: 'brandLabel',         label: 'Brand label',        placeholder: 'Brand' },
              { key: 'supplierLabel',      label: 'Supplier label',     placeholder: 'Supplier' },
            ] as const
          ).map(({ key, label, placeholder }) => (
            <TextInput
              key={key}
              label={label}
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
              placeholder={placeholder}
              maxLength={60}
            />
          ))}
        </div>
      </section>

      {/* ── List limits ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h3 className="text-sm font-semibold text-slate-900">Display limits</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Items shown before the &ldquo;Show more&rdquo; link appears. Set 0 to always show all.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextInput
            label="Max brands shown"
            type="number"
            min={1}
            max={100}
            value={form.maxBrandsVisible}
            onChange={(e) => setField('maxBrandsVisible', Number(e.target.value))}
          />
          <TextInput
            label="Max suppliers shown"
            type="number"
            min={1}
            max={100}
            value={form.maxSuppliersVisible}
            onChange={(e) => setField('maxSuppliersVisible', Number(e.target.value))}
          />
          <TextInput
            label="Price slider step (AED)"
            type="number"
            min={1}
            max={1000}
            value={form.priceSliderStep}
            onChange={(e) => setField('priceSliderStep', Number(e.target.value))}
          />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 border-t border-slate-100 pt-6">
        <SubmitButton label="Save settings" pendingLabel="Saving…" pending={pending} />
        {msg && (
          <p className={`text-sm font-medium ${msg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
