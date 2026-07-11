'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useApiQuery, useApiMutation } from '@/hooks/use-api';

type Member = {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
};

type TeamPayload = { data: { members: Member[]; invites: Invite[] } };

const ASSIGNABLE_ROLES = [
  'MANAGER',
  'PRODUCT_EDITOR',
  'MESSAGING_AGENT',
  'ANALYST'
] as const;

/**
 * Client half of /supplier/team. All requests go through the typed API
 * client (hooks/use-api.ts); the server enforces 'supplier.team.manage'
 * and org scoping — this component only renders state.
 */
export function TeamManager({
  locale,
  viewerMemberId
}: {
  locale: string;
  viewerMemberId: string;
}) {
  const t = useTranslations('supplier.team');
  const { data, error, loading, refetch } = useApiQuery<TeamPayload>(
    '/api/supplier/team'
  );

  const invite = useApiMutation<
    { email: string; role: string; locale: string },
    unknown
  >('/api/supplier/team/invite', 'POST');
  const updateMember = useApiMutation<
    { id: string; role?: string; isActive?: boolean },
    unknown
  >((input) => `/api/supplier/team/${input.id}`, 'PATCH');
  const removeMember = useApiMutation<{ id: string }, unknown>(
    (input) => `/api/supplier/team/${input.id}`,
    'DELETE'
  );
  const revokeInvite = useApiMutation<{ id: string }, unknown>(
    (input) => `/api/supplier/team/invites/${input.id}`,
    'DELETE'
  );

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('PRODUCT_EDITOR');
  const [notice, setNotice] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      await invite.mutate({ email: email.trim(), role, locale });
      setEmail('');
      setNotice(t('inviteSent'));
      refetch();
    } catch {
      /* error is rendered from invite.error below */
    }
  }

  async function run(action: Promise<unknown>) {
    setNotice(null);
    try {
      await action;
      refetch();
    } catch {
      /* per-mutation errors surface below */
    }
  }

  const members = data?.data.members ?? [];
  const invites = data?.data.invites ?? [];
  const actionError =
    invite.error ?? updateMember.error ?? removeMember.error ?? revokeInvite.error;

  const roleLabel = (r: string) =>
    t(`roles.${r}` as Parameters<typeof t>[0]);

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <form
        onSubmit={handleInvite}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-900">{t('inviteTitle')}</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={invite.loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {invite.loading ? t('sending') : t('sendInvite')}
          </button>
        </div>
        {notice && <p className="mt-2 text-sm text-emerald-600">{notice}</p>}
        {actionError && (
          <p className="mt-2 text-sm text-rose-600">{actionError.message}</p>
        )}
      </form>

      {/* Members */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
          {t('membersTitle')}
        </h2>
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">{t('loading')}</p>
        ) : error ? (
          <p className="px-4 py-6 text-sm text-rose-600">{error.message}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 text-start">{t('colName')}</th>
                  <th className="px-4 py-2 text-start">{t('colRole')}</th>
                  <th className="px-4 py-2 text-start">{t('colStatus')}</th>
                  <th className="px-4 py-2 text-start">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isOwner = m.role === 'OWNER';
                  const isSelf = m.id === viewerMemberId;
                  return (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{m.user.name}</div>
                        <div className="text-xs text-slate-500">{m.user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isOwner ? (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                            {roleLabel('OWNER')}
                          </span>
                        ) : (
                          <select
                            value={m.role}
                            disabled={updateMember.loading || isSelf}
                            onChange={(e) =>
                              run(updateMember.mutate({ id: m.id, role: e.target.value }))
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {roleLabel(r)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ' +
                            (m.isActive
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-slate-100 text-slate-500 ring-slate-200')
                          }
                        >
                          {m.isActive ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!isOwner && !isSelf && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={updateMember.loading}
                              onClick={() =>
                                run(
                                  updateMember.mutate({ id: m.id, isActive: !m.isActive })
                                )
                              }
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              {m.isActive ? t('deactivate') : t('activate')}
                            </button>
                            <button
                              type="button"
                              disabled={removeMember.loading}
                              onClick={() => {
                                if (window.confirm(t('removeConfirm'))) {
                                  run(removeMember.mutate({ id: m.id }));
                                }
                              }}
                              className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                            >
                              {t('remove')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            {t('invitesTitle')}
          </h2>
          <ul className="divide-y divide-slate-100">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{inv.email}</div>
                  <div className="text-xs text-slate-500">
                    {roleLabel(inv.role)} ·{' '}
                    {t('expires', {
                      date: new Date(inv.expiresAt).toLocaleDateString(locale)
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={revokeInvite.loading}
                  onClick={() => run(revokeInvite.mutate({ id: inv.id }))}
                  className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                >
                  {t('revoke')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
