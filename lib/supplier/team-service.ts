import 'server-only';

import { SupplierMemberRole, UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  generateResetToken,
  hashResetToken
} from '@/lib/auth/reset-token';
import { hashPassword } from '@/lib/auth/password';
import { sendEmail } from '@/lib/email/service';
import { getSiteUrl } from '@/lib/seo/site';
import { assertCanInviteMember } from '@/lib/subscriptions/limits';

/**
 * Supplier team management: employees (SupplierMember) and pending
 * invitations (SupplierInvite).
 *
 * Every function that acts inside an org takes `supplierId` from the
 * authenticated SupplierContext (require-supplier / createRoute) — never
 * from client input.
 *
 * Invite tokens follow the PasswordResetToken pattern: 256-bit random raw
 * token emailed once, only the SHA-256 hash persisted.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class TeamError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TeamError';
    this.status = status;
  }
}

export async function listTeam(supplierId: string) {
  const [members, invites] = await Promise.all([
    prisma.supplierMember.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        isActive: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.supplierInvite.findMany({
      where: { supplierId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true }
    })
  ]);
  return { members, invites };
}

/**
 * Create (or refresh) an invitation and email the accept link.
 * Re-inviting the same email replaces the previous pending invite.
 */
export async function inviteMember(params: {
  supplierId: string;
  supplierName: string;
  invitedById: string;
  email: string;
  role: SupplierMemberRole;
  locale: string;
}) {
  const { supplierId, supplierName, invitedById, email, role, locale } = params;

  // Plan cap on team size (counts active employees, not pending invites —
  // an unaccepted invite shouldn't burn a seat).
  await assertCanInviteMember(supplierId);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, supplierMembership: { select: { supplierId: true } } }
  });
  if (existingUser?.supplierMembership) {
    throw new TeamError(
      existingUser.supplierMembership.supplierId === supplierId
        ? 'This user is already a member of your team'
        : 'This user already belongs to another supplier organization',
      409
    );
  }
  if (existingUser) {
    const ownsSupplier = await prisma.supplier.findUnique({
      where: { userId: existingUser.id },
      select: { id: true }
    });
    if (ownsSupplier) {
      throw new TeamError('This user already owns a supplier organization', 409);
    }
  }

  const rawToken = generateResetToken();
  const invite = await prisma.supplierInvite.upsert({
    where: { supplierId_email: { supplierId, email } },
    update: {
      role,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedById,
      acceptedAt: null
    },
    create: {
      supplierId,
      email,
      role,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedById
    },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true }
  });

  const acceptUrl = `${getSiteUrl()}/${locale}/supplier/invite?token=${rawToken}`;
  // Fire-and-forget: an SMTP hiccup must not fail the invite itself — the
  // owner can always re-send from the team page.
  void sendEmail({
    to: email,
    subject: `You are invited to join ${supplierName} on DubaiPro`,
    html: [
      `<p>You have been invited to join <strong>${escapeHtml(supplierName)}</strong> on DubaiPro as <strong>${role}</strong>.</p>`,
      `<p><a href="${acceptUrl}">Accept the invitation</a> (valid for 7 days).</p>`,
      `<p>If you were not expecting this invitation you can safely ignore this email.</p>`
    ].join('\n'),
    text: `You have been invited to join ${supplierName} on DubaiPro as ${role}.\nAccept: ${acceptUrl}\n(The link is valid for 7 days.)`
  }).catch(() => {});

  return invite;
}

/** Look up a pending invite by raw token (for the accept page/API). */
export async function findPendingInvite(rawToken: string) {
  const invite = await prisma.supplierInvite.findUnique({
    where: { tokenHash: hashResetToken(rawToken) },
    select: {
      id: true,
      supplierId: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      supplier: { select: { name: true } }
    }
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

/**
 * Accept an invitation. Two paths:
 *   - email already registered → link that user (no password needed; the
 *     emailed token proves inbox control, mirroring password reset)
 *   - new email → requires name+password, creates the User (role SUPPLIER)
 * Returns the linked user id so the caller can start a session for new users.
 */
export async function acceptInvite(params: {
  token: string;
  name?: string;
  password?: string;
}) {
  const invite = await findPendingInvite(params.token);
  if (!invite) throw new TeamError('Invitation is invalid or has expired', 400);

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true, role: true, supplierMembership: { select: { id: true } } }
  });
  if (existingUser?.supplierMembership) {
    throw new TeamError('This account already belongs to a supplier organization', 409);
  }

  let userId: string;
  let createdAccount = false;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    if (!params.name || !params.password) {
      throw new TeamError('Name and password are required to create your account', 400);
    }
    const passwordHash = await hashPassword(params.password);
    const created = await prisma.user.create({
      data: {
        name: params.name,
        email: invite.email,
        password: passwordHash,
        role: UserRole.SUPPLIER,
        accountType: 'SUPPLIER'
      },
      select: { id: true }
    });
    userId = created.id;
    createdAccount = true;
  }

  await prisma.$transaction([
    prisma.supplierMember.create({
      data: {
        supplierId: invite.supplierId,
        userId,
        role: invite.role,
        invitedById: null
      }
    }),
    prisma.supplierInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() }
    })
  ]);

  // Tell whoever manages the team that the seat is now filled.
  void (async () => {
    const [{ notifyMany, orgMemberIdsWithPermission }, joined] = await Promise.all([
      import('@/lib/notifications/service'),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
    ]);
    const managers = (
      await orgMemberIdsWithPermission(invite.supplierId, 'supplier.team.manage')
    ).filter((id) => id !== userId);
    await notifyMany(
      managers,
      'team.member.joined',
      { memberName: joined?.name ?? invite.email, role: invite.role },
      { link: '/supplier/team' }
    );
  })().catch(() => {});

  return { userId, supplierId: invite.supplierId, createdAccount };
}

/** Change an employee's role or active flag. OWNER rows are untouchable. */
export async function updateMember(
  supplierId: string,
  memberId: string,
  patch: { role?: SupplierMemberRole; isActive?: boolean }
) {
  const member = await prisma.supplierMember.findFirst({
    where: { id: memberId, supplierId },
    select: { id: true, role: true }
  });
  if (!member) throw new TeamError('Member not found', 404);
  if (member.role === SupplierMemberRole.OWNER) {
    throw new TeamError('The owner cannot be modified', 400);
  }
  if (patch.role === SupplierMemberRole.OWNER) {
    throw new TeamError('Ownership cannot be granted here', 400);
  }

  return prisma.supplierMember.update({
    where: { id: memberId },
    data: patch,
    select: {
      id: true,
      role: true,
      isActive: true,
      user: { select: { id: true, name: true, email: true } }
    }
  });
}

/** Remove an employee from the org (their User account remains). */
export async function removeMember(supplierId: string, memberId: string) {
  const member = await prisma.supplierMember.findFirst({
    where: { id: memberId, supplierId },
    select: { id: true, role: true }
  });
  if (!member) throw new TeamError('Member not found', 404);
  if (member.role === SupplierMemberRole.OWNER) {
    throw new TeamError('The owner cannot be removed', 400);
  }
  await prisma.supplierMember.delete({ where: { id: memberId } });
}

/** Revoke a pending invitation. */
export async function revokeInvite(supplierId: string, inviteId: string) {
  const { count } = await prisma.supplierInvite.deleteMany({
    where: { id: inviteId, supplierId, acceptedAt: null }
  });
  if (count === 0) throw new TeamError('Invitation not found', 404);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
