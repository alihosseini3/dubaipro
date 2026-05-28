import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listAttributes } from '@/lib/attributes/service';
import { AttributeManager } from '@/components/admin/AttributeManager';

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = { title: 'Product Attributes' };

export default async function AdminAttributesPage({ params }: Props) {
  const { locale } = await params;
  await requireAdmin(locale, '/admin/attributes');

  const attributes = await listAttributes();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-900 to-indigo-700 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
              <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm9 0H8v2h4V5zM8 9H5v2h3V9zm4 0h-3v2h3V9zm-4 4H5v2h3v-2zm4 0h-3v2h3v-2z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold">Product Attributes</h1>
            <p className="mt-0.5 text-sm text-indigo-200">
              Global attribute library — assign to categories to enable per-category filters
            </p>
          </div>
        </div>
      </header>

      {/* Info */}
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p>
          Attributes defined here are global. Go to <strong>Categories</strong> and open any category
          to assign attributes and configure which filters appear for that category.
        </p>
      </div>

      {/* Manager */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <AttributeManager attributes={attributes} />
      </div>
    </div>
  );
}
