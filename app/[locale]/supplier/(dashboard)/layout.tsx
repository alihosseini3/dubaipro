import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { requireSupplier } from '@/lib/auth/require-supplier';
import { memberHasPermission } from '@/lib/auth/permissions';
import { SupplierShell, type SupplierNavItem } from '@/components/supplier/SupplierShell';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

const STATUS_TONE: Record<string, 'verified' | 'pending' | 'rejected'> = {
  ACTIVE: 'verified',
  PENDING_REVIEW: 'pending',
  SUSPENDED: 'rejected',
  BLACKLISTED: 'rejected',
};

export default async function SupplierDashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  const { supplier, member } = await requireSupplier(locale, `/${locale}/supplier`);

  const [t, tp, profile] = await Promise.all([
    getTranslations({ locale, namespace: 'supplier.nav' }),
    getTranslations({ locale, namespace: 'supplier.profile' }),
    prisma.supplier.findUnique({
      where: { id: supplier.id },
      select: { status: true, logoUrl: true, slug: true },
    }),
  ]);

  const status = profile?.status ?? 'PENDING_REVIEW';
  const statusTone = STATUS_TONE[status] ?? 'pending';
  const statusLabelKey = status === 'ACTIVE' ? 'statusActive'
    : status === 'SUSPENDED' ? 'statusSuspended'
    : status === 'BLACKLISTED' ? 'statusBlocked'
    : 'statusPending';

  const nav: SupplierNavItem[] = [
    { key: 'overview', label: t('overview'), href: `/${locale}/supplier`, exact: true },
    { key: 'products', label: t('products'), href: `/${locale}/supplier/products` },
    { key: 'analytics', label: t('analytics'), href: `/${locale}/supplier/analytics` },
    { key: 'profile', label: t('profile'), href: `/${locale}/supplier/profile` },
  ];
  if (memberHasPermission(member.role, 'supplier.messages', member.permissions)) {
    nav.splice(1, 0, {
      key: 'messages',
      label: t('messages'),
      href: `/${locale}/supplier/messages`
    });
  }
  if (memberHasPermission(member.role, 'supplier.samples.manage', member.permissions)) {
    nav.push({ key: 'samples', label: t('samples'), href: `/${locale}/supplier/samples` });
  }
  if (memberHasPermission(member.role, 'supplier.team.manage', member.permissions)) {
    nav.push({ key: 'team', label: t('team'), href: `/${locale}/supplier/team` });
  }
  if (
    memberHasPermission(member.role, 'supplier.subscription.view', member.permissions)
  ) {
    nav.push({
      key: 'subscription',
      label: t('subscription'),
      href: `/${locale}/supplier/subscription`
    });
  }
  nav.push({
    key: 'notifications',
    label: t('notifications'),
    href: `/${locale}/supplier/notifications`
  });

  return (
    <SupplierShell
      locale={locale}
      supplierName={supplier.name}
      statusLabel={tp(statusLabelKey as Parameters<typeof tp>[0])}
      statusTone={statusTone}
      logoUrl={profile?.logoUrl ?? null}
      storefrontHref={profile?.slug ? `/${locale}/suppliers/${profile.slug}` : null}
      nav={nav}
    >
      {children}
    </SupplierShell>
  );
}
