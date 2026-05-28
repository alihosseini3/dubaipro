import type { UserRole } from '@prisma/client';

type Props = {
  role: UserRole;
  /** Localised labels keyed by role. Keep callers in charge of i18n. */
  labels: Partial<Record<UserRole, string>>;
  className?: string;
};

/**
 * Coloured pill that identifies the current user's role. Used both in the
 * admin topbar and the public navbar so the viewer can always see — and
 * QA teams can always verify — which privileges are in effect.
 *
 * Kept presentation-only: receives a pre-resolved label so this component
 * can be rendered in both RSC and client trees without bundling
 * `next-intl` machinery.
 */
export function RoleBadge({ role, labels, className = '' }: Props) {
  const palette: Record<UserRole, string> = {
    ADMIN: 'bg-rose-50 text-rose-700 ring-rose-200',
    SUPPLIER: 'bg-sky-50 text-sky-700 ring-sky-200',
    SELLER: 'bg-violet-50 text-violet-700 ring-violet-200',
    CUSTOMER: 'bg-slate-100 text-slate-600 ring-slate-200'
  };

  const label = labels[role] ?? role;

  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ' +
        palette[role] +
        (className ? ' ' + className : '')
      }
    >
      {label}
    </span>
  );
}
