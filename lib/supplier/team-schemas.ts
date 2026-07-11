import { z } from 'zod';
import { SupplierMemberRole } from '@prisma/client';

/**
 * Request schemas for the supplier team API (app/api/supplier/team/**).
 * OWNER is deliberately absent from the assignable set: ownership is created
 * at registration and never granted through the team UI.
 */

export const ASSIGNABLE_MEMBER_ROLES = [
  SupplierMemberRole.MANAGER,
  SupplierMemberRole.PRODUCT_EDITOR,
  SupplierMemberRole.MESSAGING_AGENT,
  SupplierMemberRole.ANALYST
] as const;

const assignableRole = z.enum(
  ASSIGNABLE_MEMBER_ROLES.map((r) => r as string) as [string, ...string[]]
);

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: assignableRole,
  /** UI locale of the inviter — used for the accept link in the email. */
  locale: z
    .string()
    .regex(/^[a-z]{2}$/)
    .default('en')
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z
  .object({
    role: assignableRole.optional(),
    isActive: z.boolean().optional()
  })
  .refine((v) => v.role !== undefined || v.isActive !== undefined, {
    message: 'Nothing to update'
  });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  /** Required only when the invited email has no account yet. */
  name: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(8).max(128).optional()
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
