'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type VariantRow = {
  id: string;
  key: string;
  name: string;
  weight: number;
  config: unknown;
};
type ExperimentRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  variants: VariantRow[];
  _count: { events: number };
  createdAt: string;
  updatedAt: string;
};

export function ExperimentsManager({ locale }: { locale: string }) {
  const t = useTranslations('admin.experiments');
  const [rows, setRows] = useState<ExperimentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/experiments', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { data: ExperimentRow[] };
      setRows(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(row: ExperimentRow) {
    try {
      const res = await fetch(`/api/admin/experiments/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !row.isActive })
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }

  async function remove(row: ExperimentRow) {
    if (!confirm(t('confirmDelete', { name: row.name }))) return;
    try {
      const res = await fetch(`/api/admin/experiments/${row.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? t('loading') : t('countSummary', { n: rows.length })}
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t('newExperiment')}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">{t('cols.name')}</th>
              <th className="px-4 py-2 text-left">{t('cols.key')}</th>
              <th className="px-4 py-2 text-left">{t('cols.variants')}</th>
              <th className="px-4 py-2 text-left">{t('cols.events')}</th>
              <th className="px-4 py-2 text-left">{t('cols.status')}</th>
              <th className="px-4 py-2 text-right">{t('cols.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {t('empty')}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/${locale}/admin/experiments/${r.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {r.name}
                  </Link>
                  {r.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                      {r.description}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{r.key}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {r.variants.map((v) => `${v.key} (${v.weight})`).join(' / ')}
                </td>
                <td className="px-4 py-2 text-xs tabular-nums text-slate-600">
                  {r._count.events.toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    className={
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (r.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600')
                    }
                  >
                    {r.isActive ? t('active') : t('paused')}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateExperimentDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CreateExperimentDialog({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations('admin.experiments');
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState<{ key: string; name: string; weight: number; config: string }[]>([
    { key: 'A', name: 'Control', weight: 1, config: '{}' },
    { key: 'B', name: 'Variant', weight: 1, config: '{}' }
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateVariant(i: number, patch: Partial<(typeof variants)[number]>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const parsedVariants = variants.map((v) => {
        let cfg: unknown = {};
        if (v.config.trim()) {
          try {
            cfg = JSON.parse(v.config);
          } catch {
            throw new Error(`invalid JSON in variant ${v.key}`);
          }
          if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
            throw new Error(`config of ${v.key} must be an object`);
          }
        }
        return { key: v.key, name: v.name, weight: v.weight, config: cfg };
      });

      const res = await fetch('/api/admin/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: key.trim(),
          name: name.trim(),
          description: description.trim() || null,
          isActive: false,
          variants: parsedVariants
        })
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `status ${res.status}`);
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{t('newExperiment')}</h2>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
            {t('close')}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">{t('keyLabel')}</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="checkout_cta"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-sm"
            />
            <p className="mt-1 text-[11px] text-slate-500">{t('keyHelp')}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">{t('nameLabel')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              {t('descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">{t('variantsLabel')}</label>
              <button
                type="button"
                onClick={() =>
                  setVariants((prev) => [
                    ...prev,
                    { key: `V${prev.length + 1}`, name: '', weight: 1, config: '{}' }
                  ])
                }
                className="text-xs text-slate-600 hover:underline"
              >
                {t('addVariant')}
              </button>
            </div>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 rounded-md border border-slate-200 p-2"
                >
                  <input
                    value={v.key}
                    onChange={(e) => updateVariant(i, { key: e.target.value })}
                    placeholder="A"
                    className="col-span-2 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                  />
                  <input
                    value={v.name}
                    onChange={(e) => updateVariant(i, { name: e.target.value })}
                    placeholder={t('variantName')}
                    className="col-span-3 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    min={0}
                    value={v.weight}
                    onChange={(e) => updateVariant(i, { weight: Number(e.target.value) })}
                    className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    value={v.config}
                    onChange={(e) => updateVariant(i, { config: e.target.value })}
                    placeholder='{"label":"Buy now"}'
                    className="col-span-4 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}
                    className="col-span-1 text-xs text-red-600 hover:underline"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{t('configHelp')}</p>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? t('saving') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}
