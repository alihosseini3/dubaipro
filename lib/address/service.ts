import { prisma } from '@/lib/prisma';
import type { AddressDTO, AddressInput } from '@/types/address';

export class AddressError extends Error {
  constructor(
    public code: 'not_found' | 'forbidden' | 'validation',
    public status: number,
    message?: string,
    public details?: Record<string, string>
  ) {
    super(message ?? code);
  }
}

type AddressRow = {
  id: string;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  addressLine: string;
  postalCode: string;
  isDefault: boolean;
  createdAt: Date;
};

function toDTO(row: AddressRow): AddressDTO {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    country: row.country,
    city: row.city,
    addressLine: row.addressLine,
    postalCode: row.postalCode,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString()
  };
}

function validate(input: AddressInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  const trimmed = {
    fullName: input.fullName?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    country: input.country?.trim() ?? '',
    city: input.city?.trim() ?? '',
    addressLine: input.addressLine?.trim() ?? '',
    postalCode: input.postalCode?.trim() ?? ''
  };

  if (trimmed.fullName.length < 2) errors.fullName = 'required';
  if (trimmed.fullName.length > 120) errors.fullName = 'too_long';
  // Permissive phone check — digits plus ` +()-` separators, 6-20 chars.
  if (!/^[+()\-\s\d]{6,20}$/.test(trimmed.phone)) errors.phone = 'invalid_phone';
  if (trimmed.country.length < 2) errors.country = 'required';
  if (trimmed.city.length < 2) errors.city = 'required';
  if (trimmed.addressLine.length < 4) errors.addressLine = 'required';
  if (trimmed.postalCode.length < 2) errors.postalCode = 'required';

  return Object.keys(errors).length ? errors : null;
}

export async function listAddressesForUser(userId: string): Promise<AddressDTO[]> {
  const rows = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
  });
  return rows.map(toDTO);
}

export async function getAddressForUser(
  userId: string,
  addressId: string
): Promise<AddressDTO | null> {
  const row = await prisma.address.findFirst({
    where: { id: addressId, userId }
  });
  return row ? toDTO(row) : null;
}

export async function createAddressForUser(
  userId: string,
  input: AddressInput
): Promise<AddressDTO> {
  const errors = validate(input);
  if (errors) {
    throw new AddressError('validation', 400, 'invalid_address', errors);
  }

  // First address becomes default automatically.
  const existingCount = await prisma.address.count({ where: { userId } });
  const shouldDefault = input.isDefault === true || existingCount === 0;

  const row = await prisma.$transaction(async (tx) => {
    if (shouldDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }
    return tx.address.create({
      data: {
        userId,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        country: input.country.trim(),
        city: input.city.trim(),
        addressLine: input.addressLine.trim(),
        postalCode: input.postalCode.trim(),
        isDefault: shouldDefault
      }
    });
  });

  return toDTO(row);
}

export async function updateAddressForUser(
  userId: string,
  addressId: string,
  input: AddressInput
): Promise<AddressDTO> {
  const errors = validate(input);
  if (errors) {
    throw new AddressError('validation', 400, 'invalid_address', errors);
  }

  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId }
  });
  if (!existing) throw new AddressError('not_found', 404, 'not_found');

  const makeDefault = input.isDefault === true;

  const row = await prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, NOT: { id: addressId } },
        data: { isDefault: false }
      });
    }
    return tx.address.update({
      where: { id: addressId },
      data: {
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        country: input.country.trim(),
        city: input.city.trim(),
        addressLine: input.addressLine.trim(),
        postalCode: input.postalCode.trim(),
        isDefault: makeDefault ? true : existing.isDefault
      }
    });
  });

  return toDTO(row);
}

export async function deleteAddressForUser(
  userId: string,
  addressId: string
): Promise<void> {
  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId }
  });
  if (!existing) throw new AddressError('not_found', 404, 'not_found');

  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: addressId } });
    // If we deleted the default, promote the newest remaining address.
    if (existing.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      if (next) {
        await tx.address.update({
          where: { id: next.id },
          data: { isDefault: true }
        });
      }
    }
  });
}
