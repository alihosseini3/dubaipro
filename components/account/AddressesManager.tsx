'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type { AddressDTO, AddressInput } from '@/types/address';

type Props = {
  initial: AddressDTO[];
};

type FormState = AddressInput & { id?: string };

const EMPTY: FormState = {
  fullName: '',
  phone: '',
  country: '',
  city: '',
  addressLine: '',
  postalCode: '',
  isDefault: false
};

export function AddressesManager({ initial }: Props) {
  const t = useTranslations('account');
  const tAddr = useTranslations('address');
  const [list, setList] = useState<AddressDTO[]>(initial);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function startNew() {
    setEditing({ ...EMPTY });
    setError(null);
    setFieldErrors({});
  }
  function startEdit(a: AddressDTO) {
    setEditing({
      id: a.id,
      fullName: a.fullName,
      phone: a.phone,
      country: a.country,
      city: a.city,
      addressLine: a.addressLine,
      postalCode: a.postalCode,
      isDefault: a.isDefault
    });
    setError(null);
    setFieldErrors({});
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    setPending(true);
    try {
      const res = await fetch(`/api/address/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete_failed');
      setList((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setFieldErrors({});
    setPending(true);
    try {
      const isEdit = Boolean(editing.id);
      const url = isEdit ? `/api/address/${editing.id}` : '/api/address';
      const method = isEdit ? 'PATCH' : 'POST';
      const { id: _id, ...body } = editing;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: AddressDTO;
        error?: string;
        details?: Record<string, string>;
      };
      if (!res.ok || !payload.data) {
        if (payload.details) setFieldErrors(payload.details);
        throw new Error(payload.error ?? 'save_failed');
      }
      // Refetch full list to keep default-flag state consistent after
      // the transactional updateMany on the server.
      const listRes = await fetch('/api/address');
      if (listRes.ok) {
        const listPayload = (await listRes.json()) as { data: AddressDTO[] };
        setList(listPayload.data);
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    'block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/15 disabled:bg-slate-50';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('addressesTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('addressesSubtitle')}</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startNew}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
          >
            + {t('addAddress')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-base font-semibold text-slate-900">
            {editing.id ? t('editAddress') : t('addAddress')}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={tAddr('fullName')}
              error={fieldErrors.fullName}
            >
              <input
                className={inputClass}
                value={editing.fullName}
                onChange={(e) =>
                  setEditing({ ...editing, fullName: e.target.value })
                }
                required
                disabled={pending}
              />
            </Field>
            <Field label={tAddr('phone')} error={fieldErrors.phone}>
              <input
                className={inputClass}
                value={editing.phone}
                onChange={(e) =>
                  setEditing({ ...editing, phone: e.target.value })
                }
                required
                disabled={pending}
              />
            </Field>
            <Field label={tAddr('country')} error={fieldErrors.country}>
              <input
                className={inputClass}
                value={editing.country}
                onChange={(e) =>
                  setEditing({ ...editing, country: e.target.value })
                }
                required
                disabled={pending}
              />
            </Field>
            <Field label={tAddr('city')} error={fieldErrors.city}>
              <input
                className={inputClass}
                value={editing.city}
                onChange={(e) =>
                  setEditing({ ...editing, city: e.target.value })
                }
                required
                disabled={pending}
              />
            </Field>
            <Field label={tAddr('postalCode')} error={fieldErrors.postalCode}>
              <input
                className={inputClass}
                value={editing.postalCode}
                onChange={(e) =>
                  setEditing({ ...editing, postalCode: e.target.value })
                }
                required
                disabled={pending}
              />
            </Field>
            <Field
              label={tAddr('addressLine')}
              error={fieldErrors.addressLine}
              full
            >
              <textarea
                className={`${inputClass} min-h-[72px]`}
                value={editing.addressLine}
                onChange={(e) =>
                  setEditing({ ...editing, addressLine: e.target.value })
                }
                required
                disabled={pending}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              checked={Boolean(editing.isDefault)}
              onChange={(e) =>
                setEditing({ ...editing, isDefault: e.target.checked })
              }
              disabled={pending}
            />
            {t('makeDefault')}
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
            >
              {pending ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={pending}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          {t('noAddresses')}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{a.fullName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{a.phone}</p>
                </div>
                {a.isDefault && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                    {t('defaultLabel')}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {a.addressLine}, {a.city}, {a.country} {a.postalCode}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(a)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={pending}
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  {t('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  full,
  children
}: {
  label: string;
  error?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
