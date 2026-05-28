'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type Category = { id: string; name: string };
type Supplier = { id: string; name: string; verified: boolean };

type Props = {
  basePath:      string;
  tab:           string;
  initialCategory: string;
  initialSupplier: string;
  endingSoon:    boolean;
  reserveMet:    boolean;
  categories:    Category[];
  suppliers:     Supplier[];
  labels: {
    category:      string;
    allCategories: string;
    supplier:      string;
    allSuppliers:  string;
    submit:        string;
  };
};

/**
 * Client wrapper that owns the two select inputs and navigates on
 * change. Avoids a sync FormData submission so we can preserve the
 * locale prefix and any toggle filters via Next router.
 */
export function FilterSubmit({
  basePath, tab,
  initialCategory, initialSupplier, endingSoon, reserveMet,
  categories, suppliers, labels,
}: Props) {
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [supplier, setSupplier] = useState(initialSupplier);
  const [pending, start] = useTransition();

  function navigate(next: { category?: string; supplier?: string }) {
    const params = new URLSearchParams();
    params.set('tab', tab);
    const cat = next.category ?? category;
    const sup = next.supplier ?? supplier;
    if (cat) params.set('category', cat);
    if (sup) params.set('supplier', sup);
    if (endingSoon) params.set('endingSoon', '1');
    if (reserveMet) params.set('reserveMet', '1');
    start(() => router.push(`${basePath}/auctions?${params.toString()}`));
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-700">{labels.category}</label>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); navigate({ category: e.target.value }); }}
          disabled={pending}
          className="block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#F97316] focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
        >
          <option value="">{labels.allCategories}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-slate-700">{labels.supplier}</label>
        <select
          value={supplier}
          onChange={(e) => { setSupplier(e.target.value); navigate({ supplier: e.target.value }); }}
          disabled={pending}
          className="block w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#F97316] focus:bg-white focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
        >
          <option value="">{labels.allSuppliers}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.verified ? `✓ ${s.name}` : s.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
