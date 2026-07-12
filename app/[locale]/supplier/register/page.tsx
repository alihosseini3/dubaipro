import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { getSupplierRegistrationState } from '@/lib/supplier/registration-service';
import {
  RegisterWizard,
  type WizardCategory
} from '@/components/supplier/register/RegisterWizard';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'supplierRegister' });
  return { title: `${t('title')} — DubaiPro`, description: t('subtitle') };
}

export default async function SupplierRegisterPage({ params }: Props) {
  const { locale } = await params;

  const [categories, user] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, parentId: true }
    }),
    getCurrentUser()
  ]);

  // Resume an in-progress (or rejected) application. An APPROVED supplier has
  // nothing to do here — the wizard would only let them demote themselves, so
  // send them to the dashboard where profile edits live.
  const initialState = user ? await getSupplierRegistrationState(user.id) : null;
  if (initialState?.onboardingStatus === 'APPROVED') {
    redirect(`/${locale}/supplier`);
  }

  return (
    <RegisterWizard
      locale={locale}
      categories={categories as WizardCategory[]}
      isAuthenticated={Boolean(user)}
      initialState={initialState}
    />
  );
}
