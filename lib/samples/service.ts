import 'server-only';

import { Prisma, SampleRequestStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { PUBLIC_PRODUCT_WHERE } from '@/lib/products/visibility';
import { createSampleConversation, sendMessage } from '@/lib/messaging/service';
import {
  notify,
  notifyMany,
  orgMemberIdsWithPermission
} from '@/lib/notifications/service';

import type { SampleCreateInput } from '@/lib/messaging/schemas';

/**
 * Sample requests: buyer asks for a product sample, supplier drives the
 * status (accept → ship → close, or decline). Every request has a linked
 * SAMPLE conversation; status changes post SYSTEM messages there so the
 * whole negotiation history lives in one thread.
 */

export class SampleError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SampleError';
    this.status = status;
  }
}

export { checkSampleTransition, type SampleAction } from './workflow';
import { checkSampleTransition, type SampleAction } from './workflow';

const SAMPLE_SELECT = {
  id: true,
  quantity: true,
  message: true,
  shippingInfo: true,
  status: true,
  conversationId: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { id: true, title: true, slug: true, imageUrl: true } },
  buyer: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } }
} satisfies Prisma.SampleRequestSelect;

export async function createSampleRequest(buyerId: string, input: SampleCreateInput) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, ...PUBLIC_PRODUCT_WHERE },
    select: { id: true, title: true, supplierId: true, samplePrice: true }
  });
  if (!product) throw new SampleError('Product not found', 404);

  const selfMembership = await prisma.supplierMember.findUnique({
    where: { userId: buyerId },
    select: { supplierId: true }
  });
  if (selfMembership?.supplierId === product.supplierId) {
    throw new SampleError('You cannot request a sample from your own company', 400);
  }

  const open = await prisma.sampleRequest.findFirst({
    where: {
      buyerId,
      productId: product.id,
      status: { in: [SampleRequestStatus.PENDING, SampleRequestStatus.ACCEPTED] }
    },
    select: { id: true }
  });
  if (open) {
    throw new SampleError('You already have an open sample request for this product', 409);
  }

  const conversation = await createSampleConversation({
    buyerId,
    supplierId: product.supplierId,
    productId: product.id,
    subject: product.title,
    firstMessage:
      `[Sample request · ${input.quantity} pcs] ` +
      (input.message?.trim() || 'Sample requested.')
  });

  const sample = await prisma.sampleRequest.create({
    data: {
      productId: product.id,
      buyerId,
      supplierId: product.supplierId,
      quantity: input.quantity,
      message: input.message?.trim() || null,
      shippingInfo: input.shippingInfo ?? undefined,
      conversationId: conversation.id
    },
    select: SAMPLE_SELECT
  });

  void orgMemberIdsWithPermission(product.supplierId, 'supplier.samples.manage')
    .then((userIds) =>
      notifyMany(
        userIds,
        'sample.requested',
        { productTitle: product.title, buyerName: sample.buyer.name },
        { link: `/supplier/samples` }
      )
    )
    .catch(() => {});

  return sample;
}

export async function listBuyerSamples(buyerId: string, page: number, pageSize: number) {
  const where = { buyerId };
  const [items, total] = await Promise.all([
    prisma.sampleRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: SAMPLE_SELECT
    }),
    prisma.sampleRequest.count({ where })
  ]);
  return { items, total };
}

export async function listSupplierSamples(
  supplierId: string,
  options: { status?: SampleRequestStatus; page: number; pageSize: number }
) {
  const where: Prisma.SampleRequestWhereInput = {
    supplierId,
    ...(options.status ? { status: options.status } : {})
  };
  const [items, total, statusCounts] = await Promise.all([
    prisma.sampleRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: SAMPLE_SELECT
    }),
    prisma.sampleRequest.count({ where }),
    prisma.sampleRequest.groupBy({
      by: ['status'],
      where: { supplierId },
      _count: { _all: true }
    })
  ]);
  return {
    items,
    total,
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]))
  };
}

/**
 * Supplier-side status decision. `actorId` is the acting org member — used
 * as the sender of the SYSTEM message in the linked thread.
 */
export async function updateSampleStatus(
  supplierId: string,
  actorId: string,
  sampleId: string,
  action: SampleAction
) {
  const sample = await prisma.sampleRequest.findFirst({
    where: { id: sampleId, supplierId },
    select: { id: true, status: true, conversationId: true, product: { select: { title: true } } }
  });
  if (!sample) throw new SampleError('Sample request not found', 404);

  const to = checkSampleTransition(action, sample.status);
  if (!to) {
    throw new SampleError(`Cannot ${action} a ${sample.status} sample request`, 409);
  }

  const updated = await prisma.sampleRequest.update({
    where: { id: sample.id },
    data: { status: to },
    select: SAMPLE_SELECT
  });

  if (sample.conversationId) {
    // Best effort — a messaging hiccup must not fail the status change.
    await sendMessage({
      conversationId: sample.conversationId,
      senderId: actorId,
      content: `[Sample ${to}] ${sample.product.title}`,
      type: 'SYSTEM'
    }).catch(() => {});
  }

  void notify(
    updated.buyer.id,
    'sample.status',
    { productTitle: updated.product.title, status: to },
    { link: `/account/samples` }
  ).catch(() => {});

  return updated;
}
