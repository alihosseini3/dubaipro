import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { requireSupplier } from '@/lib/auth/require-supplier';
import { prisma } from '@/lib/prisma';
import { getSupplierRegistrationState } from '@/lib/supplier/registration-service';
import {
  SupplierProfileManager,
  type ProfileInitial,
} from '@/components/supplier/profile/SupplierProfileManager';
import type { PickerCategory } from '@/components/supplier/profile/CategoryTreePicker';
import { ProfileForm } from '@/components/account/ProfileForm';
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';

export const metadata: Metadata = { title: 'Profile | Supplier Dashboard' };

type Props = { params: Promise<{ locale: string }> };

export default async function SupplierProfilePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'supplier.profile' });
  const { supplier, user } = await requireSupplier(locale, `/${locale}/supplier/profile`);

  const [state, branding, categories] = await Promise.all([
    getSupplierRegistrationState(user.id),
    prisma.supplier.findUnique({
      where: { id: supplier.id },
      select: {
        name: true,
        slug: true,
        status: true,
        logoUrl: true,
        bannerUrl: true,
        shortTagline: true,
        description: true,
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  const initial: ProfileInitial = {
    email: user.email,
    name: branding?.name ?? supplier.name,
    slug: branding?.slug ?? null,
    status: branding?.status ?? 'PENDING_REVIEW',
    onboardingStatus: state?.onboardingStatus ?? 'DRAFT',
    logoUrl: branding?.logoUrl ?? null,
    bannerUrl: branding?.bannerUrl ?? null,
    shortTagline: branding?.shortTagline ?? null,
    description: branding?.description ?? null,
    companyName: state?.companyName ?? null,
    tradeName: state?.tradeName ?? null,
    tradeLicenseNumber: state?.tradeLicenseNumber ?? null,
    companyType: state?.companyType ?? null,
    phones: state?.phones ?? [],
    country: state?.country ?? null,
    emirate: state?.emirate ?? null,
    city: state?.city ?? null,
    address: state?.address ?? null,
    latitude: state?.latitude ?? null,
    longitude: state?.longitude ?? null,
    primaryCategoryId: state?.primaryCategoryId ?? null,
    secondaryCategoryIds: state?.secondaryCategoryIds ?? [],
    documents: state?.documents ?? [],
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('subtitle')}
        </p>
      </div>
      <SupplierProfileManager
        locale={locale}
        initial={initial}
        categories={categories as PickerCategory[]}
      />

      <section className="mt-6">
        <div className="mb-4 border-t border-slate-200 pt-6">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{t('accountSecurity')}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('accountSecurityDesc')}
          </p>
        </div>
        <div className="space-y-6">
          <ProfileForm initial={{ name: user.name, email: user.email }} />
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
