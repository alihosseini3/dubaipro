'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { FormMessage, Select, SubmitButton } from './AdminForm';

type UserRoleFormProps = {
  userId: string;
  currentRole: string;
  currentName: string;
  /** Disable the form when the target is the acting admin (self-edit lock). */
  isSelf: boolean;
};

const ROLES = ['ADMIN', 'CUSTOMER', 'SELLER', 'SUPPLIER'] as const;

/**
 * Admin-side form for updating a user's display name and role.
 *
 * The form POSTs a PATCH to `/api/admin/users/[id]` and refreshes the
 * current route afterwards so the server component re-reads the fresh
 * row. Self-edit is blocked server-side AND disabled client-side for a
 * clearer UX.
 */
export function UserRoleForm({
  userId,
  currentRole,
  currentName,
  isSelf
}: UserRoleFormProps) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('admin.common');
  const tRole = useTranslations('auth.role');
  const router = useRouter();

  const [name, setName] = useState(currentName);
  const [role, setRole] = useState(currentRole);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const unchanged = name.trim() === currentName && role === currentRole;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), role })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `status ${res.status}`);
      }
      setSuccess(t('updateSuccess'));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('saveFailed'));
    } finally {
      setPending(false);
    }
  }

  const roleOptions = ROLES.map((r) => ({
    value: r,
    label: tRole(r.toLowerCase() as Lowercase<(typeof ROLES)[number]>)
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <FormMessage type="error">{error}</FormMessage>}
      {success && <FormMessage type="success">{success}</FormMessage>}

      <div>
        <label htmlFor="user-name" className="mb-1 block text-sm font-medium text-slate-700">
          {t('fieldName')}
        </label>
        <input
          id="user-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
        />
      </div>

      <Select
        name="role"
        label={t('fieldRole')}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        disabled={pending || isSelf}
        hint={isSelf ? t('selfRoleLocked') : undefined}
        options={roleOptions}
      />

      <SubmitButton
        label={tCommon('save')}
        pendingLabel={tCommon('saving')}
        pending={pending}
        disabled={unchanged}
      />
    </form>
  );
}
