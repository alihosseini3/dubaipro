'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { FormMessage, Select, SubmitButton, TextInput, Toggle } from './AdminForm';

type UserOption = { id: string; name: string; email: string };

type SupplierFormValues = {
  id?: string;
  userId: string;
  name: string;
  country: string;
  phone: string;
  verified: boolean;
};

type SupplierFormProps = {
  initial?: Partial<SupplierFormValues>;
  users: UserOption[];
  locale: string;
};

const empty: SupplierFormValues = {
  userId: '',
  name: '',
  country: '',
  phone: '',
  verified: false
};

export function SupplierForm({ initial, users, locale }: SupplierFormProps) {
  const t = useTranslations('admin.suppliers');
  const tCommon = useTranslations('admin.common');
  const router = useRouter();

  const [values, setValues] = useState<SupplierFormValues>({
    ...empty,
    ...initial,
    userId: initial?.userId ?? users[0]?.id ?? ''
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEdit = Boolean(values.id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!values.name.trim() || !values.country.trim() || (!isEdit && !values.userId)) {
      setError(tCommon('validationError'));
      return;
    }

    setPending(true);
    try {
      const endpoint = isEdit ? `/api/suppliers/${values.id}` : '/api/suppliers';
      const method = isEdit ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = {
        name: values.name.trim(),
        country: values.country.trim(),
        phone: values.phone.replace(/\D+/g, ''),
        verified: values.verified
      };
      if (!isEdit) body.userId = values.userId;

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
        if (json.data?.id) router.push(`/${locale}/admin/suppliers/${json.data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('saveFailed'));
    } finally {
      setPending(false);
    }
  }

  function update<K extends keyof SupplierFormValues>(key: K, value: SupplierFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const userOptions = users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <FormMessage type="error">{error}</FormMessage>}
      {success && <FormMessage type="success">{success}</FormMessage>}

      {!isEdit && (
        users.length === 0 ? (
          <FormMessage type="error">{t('noUsersWarning')}</FormMessage>
        ) : (
          <Select
            name="userId"
            label={t('fieldUser')}
            value={values.userId}
            onChange={(e) => update('userId', e.target.value)}
            options={userOptions}
            required
          />
        )
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput
          name="name"
          label={t('fieldName')}
          required
          value={values.name}
          onChange={(e) => update('name', e.target.value)}
        />
        <TextInput
          name="country"
          label={t('fieldCountry')}
          required
          value={values.country}
          onChange={(e) => update('country', e.target.value)}
        />
        <TextInput
          name="phone"
          label={t('fieldPhone')}
          value={values.phone}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="971500000000"
        />
      </div>

      <Toggle
        label={t('fieldVerified')}
        description={t('fieldVerifiedDescription')}
        checked={values.verified}
        onChange={(v) => update('verified', v)}
      />

      <SubmitButton
        label={isEdit ? tCommon('update') : tCommon('create')}
        pendingLabel={isEdit ? tCommon('updating') : tCommon('creating')}
        pending={pending}
      />
    </form>
  );
}
