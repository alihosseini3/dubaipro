import { getTranslations } from 'next-intl/server';

import { requireSupplierPermission } from '@/lib/auth/require-supplier';
import { prisma } from '@/lib/prisma';
import { VerificationManager } from '@/components/supplier/verification/VerificationManager';

type Props = { params: Promise<{ locale: string }> };

/**
 * Supplier-facing verification: current tier status, upload certifications,
 * and submit for admin review. Wires the certification/verification service
 * layer (built in an earlier phase but previously unreachable from any UI)
 * to the dashboard.
 */
export default async function SupplierVerificationPage({ params }: Props) {
  const { locale } = await params;
  const { supplier } = await requireSupplierPermission(
    locale,
    'supplier.verification.manage',
    `/${locale}/supplier/verification`
  );
  const t = await getTranslations({ locale, namespace: 'supplier.verification' });

  const [row, certifications] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id: supplier.id },
      select: { tier: true, status: true, verifiedAt: true, verificationExpiresAt: true }
    }),
    prisma.supplierCertification.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        title: true,
        issuer: true,
        fileUrl: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        reviewerNote: true
      }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </div>
      <VerificationManager
        tier={row?.tier ?? 'STANDARD'}
        supplierStatus={row?.status ?? 'PENDING_REVIEW'}
        verifiedAt={row?.verifiedAt?.toISOString() ?? null}
        verificationExpiresAt={row?.verificationExpiresAt?.toISOString() ?? null}
        certifications={certifications.map((c) => ({
          ...c,
          issuedAt: c.issuedAt?.toISOString() ?? null,
          expiresAt: c.expiresAt?.toISOString() ?? null
        }))}
      />
    </div>
  );
}
