import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { getSupplierRegistrationState } from '@/lib/supplier/registration-service';
import {
  SupplierRegisterWizard,
  type WizardCategory,
} from '@/components/supplier/SupplierRegisterWizard';

export const metadata = {
  title: 'Become a Supplier — DubaiPro',
  description: 'Register your company and start selling to verified buyers across the region.',
};

type Props = { params: Promise<{ locale: string }> };

export default async function SupplierRegisterPage({ params }: Props) {
  const { locale } = await params;

  const [categories, user] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, parentId: true },
    }),
    getCurrentUser(),
  ]);

  // Resume an in-progress draft for an already-authenticated supplier.
  const initialState = user ? await getSupplierRegistrationState(user.id) : null;

  return (
    <SupplierRegisterWizard
      locale={locale}
      categories={categories as WizardCategory[]}
      isAuthenticated={Boolean(user)}
      initialState={initialState}
    />
  );
}
