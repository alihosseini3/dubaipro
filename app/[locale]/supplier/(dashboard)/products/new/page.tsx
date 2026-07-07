'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch('/api/supplier/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (res.ok) {
        router.push('/supplier/products');
      } else {
        alert('Failed to create product');
      }
    } catch {
      alert('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Add New Product</h1>
        <Link href="/supplier/products" className="text-sm text-slate-500 hover:text-slate-700">Cancel</Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-bold">Basic Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Product Title *</label>
              <input name="title" required className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700" placeholder="e.g., High-Performance Electric Motorcycle" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Slug</label>
              <input name="slug" className="w-full rounded-xl border px-4 py-2.5 text-sm dark:bg-slate-700" placeholder="product-url-slug" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category *</label>
              <select name="categoryId" required className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700">
                <option value="">Select category</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea name="description" rows={4} className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700" placeholder="Detailed product description..." />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-bold">Pricing & MOQ</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Price *</label>
              <input name="price" type="number" step="0.01" required className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <select name="currency" className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700">
                <option>USD</option>
                <option>EUR</option>
                <option>AED</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">MOQ</label>
              <input name="moq" type="number" defaultValue="1" className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-lg font-bold">Trade Terms</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Trade Terms</label>
              <select name="tradeTerms" className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700">
                <option>FOB</option>
                <option>CIF</option>
                <option>EXW</option>
                <option>DDP</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Origin Country</label>
              <input name="originCountry" className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700" placeholder="e.g., China" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Lead Time (Days)</label>
              <input name="leadTimeDays" type="number" className="w-full rounded-xl border px-4 py-2.5 dark:bg-slate-700" />
            </div>
          </div>
        </section>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-orange-500 py-3 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Product (Draft)'}
          </button>
          <button
            type="submit"
            name="publish"
            value="true"
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-green-500 py-3 font-bold text-white hover:bg-green-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Publishing...' : 'Publish Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
