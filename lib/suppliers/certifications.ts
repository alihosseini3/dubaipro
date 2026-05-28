import 'server-only';

import { type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

/**
 * Certification management.
 *
 * Files themselves live in `MediaAsset`; this table mirrors the URL +
 * admin-review metadata so the supplier "Certifications" tab and the
 * admin verification queue can read all the info in a single query.
 *
 * Status transitions:
 *   PENDING ──(admin approve)──▶ APPROVED
 *   PENDING ──(admin reject)───▶ REJECTED
 *   APPROVED ──(cron / admin)──▶ EXPIRED  (when expiresAt < now)
 */

export type CreateCertInput = {
  supplierId: string;
  type: string;
  title: string;
  issuer?: string | null;
  fileUrl: string;
  thumbUrl?: string | null;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  order?: number;
};

export async function createCertification(input: CreateCertInput) {
  return prisma.supplierCertification.create({
    data: {
      supplierId: input.supplierId,
      type: input.type.trim() || 'CUSTOM',
      title: input.title.trim(),
      issuer: input.issuer?.trim() ?? null,
      fileUrl: input.fileUrl,
      thumbUrl: input.thumbUrl ?? null,
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      order: input.order ?? 0
    }
  });
}

export type UpdateCertInput = Partial<{
  title: string;
  issuer: string | null;
  type: string;
  fileUrl: string;
  thumbUrl: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  order: number;
}>;

export async function updateCertification(
  id: string,
  patch: UpdateCertInput
) {
  const data: Prisma.SupplierCertificationUpdateInput = { ...patch };
  return prisma.supplierCertification.update({ where: { id }, data });
}

export async function deleteCertification(id: string) {
  return prisma.supplierCertification.delete({ where: { id } });
}

/** Admin approves a pending cert. `reviewerId` is the admin user id. */
export async function approveCertification(
  id: string,
  reviewerId: string,
  note?: string | null
) {
  return prisma.supplierCertification.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewerId,
      reviewerNote: note ?? null
    }
  });
}

export async function rejectCertification(
  id: string,
  reviewerId: string,
  note: string
) {
  return prisma.supplierCertification.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewerId,
      reviewerNote: note
    }
  });
}

/**
 * Mark all certs whose `expiresAt < now` AND status=APPROVED as EXPIRED.
 * Designed to be called from a cron route (`/api/cron/*`).
 */
export async function expireOverdueCertifications(now: Date = new Date()) {
  const { count } = await prisma.supplierCertification.updateMany({
    where: { status: 'APPROVED', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' }
  });
  return count;
}

/** List certs for a supplier — optionally filtered by status. */
export async function listSupplierCertifications(
  supplierId: string,
  opts: { onlyApproved?: boolean } = {}
) {
  return prisma.supplierCertification.findMany({
    where: opts.onlyApproved
      ? { supplierId, status: 'APPROVED' }
      : { supplierId },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }]
  });
}
