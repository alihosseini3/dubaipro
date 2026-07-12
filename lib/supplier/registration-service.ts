import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createSession, type SessionUser } from '@/lib/auth/session';
import { generateUniqueSupplierSlug } from '@/lib/suppliers/slug';
import type { ValidationErrors } from '@/lib/api/validation';
import {
  DEFAULT_COUNTRY,
  EMAIL_RE,
  MIN_STORE_PHOTOS,
  REQUIRED_DOCUMENT_TYPES,
  isCompanyType,
  isStrongPassword,
  isValidPhone,
  normalizePhone,
  type SupplierRegisterPayload,
  type SupplierRegistrationState,
} from './registration';

/** Validate, normalise and de-duplicate a list of phone numbers. */
function normalizePhones(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [raw];
  const cleaned = list
    .filter((p): p is string => typeof p === 'string')
    .map((p) => normalizePhone(p))
    .filter((p) => p.length > 0);
  return [...new Set(cleaned)];
}

/** Thrown by the service to signal a 4xx with field-level details. */
export class SupplierRegistrationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly details?: ValidationErrors
  ) {
    super(message);
    this.name = 'SupplierRegistrationError';
  }
}

const SUPPLIER_STATE_SELECT = {
  id: true,
  onboardingStatus: true,
  companyName: true,
  tradeName: true,
  tradeLicenseNumber: true,
  companyType: true,
  phones: true,
  country: true,
  emirate: true,
  city: true,
  address: true,
  latitude: true,
  longitude: true,
  primaryCategoryId: true,
  secondaryCategories: { select: { categoryId: true } },
  documents: {
    select: { id: true, type: true, fileUrl: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.SupplierSelect;

type SupplierStateRow = Prisma.SupplierGetPayload<{ select: typeof SUPPLIER_STATE_SELECT }>;

function toState(row: SupplierStateRow): SupplierRegistrationState {
  return {
    supplierId: row.id,
    onboardingStatus: row.onboardingStatus,
    companyName: row.companyName,
    tradeName: row.tradeName,
    tradeLicenseNumber: row.tradeLicenseNumber,
    companyType: row.companyType,
    phones: row.phones,
    country: row.country,
    emirate: row.emirate,
    city: row.city,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    primaryCategoryId: row.primaryCategoryId,
    secondaryCategoryIds: row.secondaryCategories.map((c) => c.categoryId),
    documents: row.documents.map((d) => ({
      id: d.id,
      type: d.type,
      fileUrl: d.fileUrl,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

/** Returns the onboarding state for a user's supplier, or null. */
export async function getSupplierRegistrationState(
  userId: string
): Promise<SupplierRegistrationState | null> {
  const row = await prisma.supplier.findUnique({
    where: { userId },
    select: SUPPLIER_STATE_SELECT,
  });
  return row ? toState(row) : null;
}

/**
 * Create the supplier account (Step 1) for an anonymous visitor: registers
 * the User (role + accountType = SUPPLIER), starts a session, and creates a
 * DRAFT Supplier row. Returns the freshly created session user.
 */
async function createAccount(
  account: SupplierRegisterPayload['account']
): Promise<{ user: SessionUser; supplierId: string }> {
  const errors: ValidationErrors = {};
  const name = typeof account?.name === 'string' ? account.name.trim() : '';
  const emailRaw = typeof account?.email === 'string' ? account.email.trim().toLowerCase() : '';
  const phones = normalizePhones(account?.phones);
  const password = typeof account?.password === 'string' ? account.password : '';

  if (!name) errors.name = 'Full name is required';
  if (!EMAIL_RE.test(emailRaw)) errors.email = 'A valid email is required';
  if (phones.length === 0) {
    errors.phones = 'At least one mobile number is required';
  } else if (!phones.every((p) => isValidPhone(p))) {
    errors.phones = 'One or more mobile numbers are invalid';
  }
  if (!isStrongPassword(password)) {
    errors.password = 'Password must be 8+ characters and include letters and numbers';
  }
  if (Object.keys(errors).length > 0) {
    throw new SupplierRegistrationError('Validation failed', 400, errors);
  }

  const primaryPhone = phones[0];

  // Uniqueness pre-checks for friendly field errors (race still guarded
  // by the DB unique constraints in the transaction below).
  const [emailTaken, phoneTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: emailRaw }, select: { id: true } }),
    prisma.user.findUnique({ where: { phone: primaryPhone }, select: { id: true } }),
  ]);
  if (emailTaken) errors.email = 'An account with this email already exists';
  if (phoneTaken) errors.phones = 'An account with this mobile number already exists';
  if (Object.keys(errors).length > 0) {
    throw new SupplierRegistrationError('Validation failed', 409, errors);
  }

  const passwordHash = await hashPassword(password);
  const slug = await generateUniqueSupplierSlug(name);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email: emailRaw,
        phone: primaryPhone,
        password: passwordHash,
        role: 'SUPPLIER',
        accountType: 'SUPPLIER',
        supplier: {
          create: {
            name,
            country: DEFAULT_COUNTRY,
            phone: primaryPhone,
            phones,
            slug,
            companyName: name,
            onboardingStatus: 'DRAFT',
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        supplier: { select: { id: true } },
      },
    });

    // OWNER team membership — the access path used by require-supplier.
    // Separate create (cross-linking two nested creates isn't possible);
    // resolveMembership self-heals if this ever races.
    await prisma.supplierMember.create({
      data: { supplierId: user.supplier!.id, userId: user.id, role: 'OWNER' },
    });

    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    await createSession(sessionUser);
    return { user: sessionUser, supplierId: user.supplier!.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(',') ?? '';
      const field = target.includes('phone') ? 'phones' : 'email';
      throw new SupplierRegistrationError('Validation failed', 409, {
        [field]: 'already in use',
      });
    }
    throw error;
  }
}

/** Resolve (or create) the supplier row for an authenticated user. */
async function ensureSupplierForUser(user: SessionUser): Promise<string> {
  const existing = await prisma.supplier.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) return existing.id;

  const slug = await generateUniqueSupplierSlug(user.name);
  const created = await prisma.supplier.create({
    data: {
      userId: user.id,
      name: user.name,
      country: DEFAULT_COUNTRY,
      slug,
      companyName: user.name,
      onboardingStatus: 'DRAFT',
      members: {
        create: { userId: user.id, role: 'OWNER' }
      }
    },
    select: { id: true },
  });
  return created.id;
}

/** Build the partial Supplier update from company/location blocks. */
function buildSupplierUpdate(payload: SupplierRegisterPayload): Prisma.SupplierUpdateInput {
  const data: Prisma.SupplierUpdateInput = {};
  const { account, company, location } = payload;

  // Allow updating the contact-number list from the account block (the
  // primary login phone on `User` is set at creation and not changed here).
  if (account?.phones !== undefined) {
    const phones = normalizePhones(account.phones);
    if (phones.length > 0 && !phones.every((p) => isValidPhone(p))) {
      throw new SupplierRegistrationError('Validation failed', 400, {
        phones: 'One or more mobile numbers are invalid',
      });
    }
    data.phones = phones;
  }

  if (company) {
    if (company.companyName !== undefined) {
      data.companyName = company.companyName?.trim() || null;
      // Keep the public storefront display name in sync when provided.
      if (company.companyName?.trim()) data.name = company.companyName.trim();
    }
    if (company.tradeName !== undefined) data.tradeName = company.tradeName?.trim() || null;
    if (company.tradeLicenseNumber !== undefined) {
      data.tradeLicenseNumber = company.tradeLicenseNumber?.trim() || null;
    }
    if (company.companyType !== undefined) {
      if (company.companyType && !isCompanyType(company.companyType)) {
        throw new SupplierRegistrationError('Validation failed', 400, {
          companyType: 'Invalid company type',
        });
      }
      data.companyType = company.companyType ?? null;
    }
  }

  if (location) {
    if (location.country !== undefined) data.country = location.country?.trim() || DEFAULT_COUNTRY;
    if (location.emirate !== undefined) data.emirate = location.emirate?.trim() || null;
    if (location.city !== undefined) data.city = location.city?.trim() || null;
    if (location.address !== undefined) data.address = location.address?.trim() || null;
    if (location.latitude !== undefined) {
      data.latitude =
        typeof location.latitude === 'number' && Number.isFinite(location.latitude)
          ? location.latitude
          : null;
    }
    if (location.longitude !== undefined) {
      data.longitude =
        typeof location.longitude === 'number' && Number.isFinite(location.longitude)
          ? location.longitude
          : null;
    }
  }

  return data;
}

/** Validate + apply the primary/secondary category selection. */
async function applyCategories(
  supplierId: string,
  categories: NonNullable<SupplierRegisterPayload['categories']>
): Promise<Prisma.SupplierUpdateInput> {
  const data: Prisma.SupplierUpdateInput = {};

  const primaryId = categories.primaryCategoryId?.trim();
  const secondaryIds = Array.isArray(categories.secondaryCategoryIds)
    ? [...new Set(categories.secondaryCategoryIds.map((s) => s.trim()).filter(Boolean))]
    : undefined;

  // Collect every referenced id and verify they exist + are active.
  const referenced = [
    ...(primaryId ? [primaryId] : []),
    ...(secondaryIds ?? []),
  ];
  if (referenced.length > 0) {
    const found = await prisma.category.findMany({
      where: { id: { in: referenced }, isActive: true },
      select: { id: true },
    });
    const validIds = new Set(found.map((c) => c.id));
    if (primaryId && !validIds.has(primaryId)) {
      throw new SupplierRegistrationError('Validation failed', 400, {
        primaryCategoryId: 'Unknown category',
      });
    }
    if (secondaryIds?.some((id) => !validIds.has(id))) {
      throw new SupplierRegistrationError('Validation failed', 400, {
        secondaryCategoryIds: 'One or more categories are unknown',
      });
    }
  }

  if (categories.primaryCategoryId !== undefined) {
    data.primaryCategory = primaryId
      ? { connect: { id: primaryId } }
      : { disconnect: true };
  }

  if (secondaryIds !== undefined) {
    // Replace the whole secondary set, excluding the primary.
    const finalSecondary = secondaryIds.filter((id) => id !== primaryId);
    await prisma.$transaction([
      prisma.supplierCategory.deleteMany({ where: { supplierId } }),
      ...(finalSecondary.length > 0
        ? [
            prisma.supplierCategory.createMany({
              data: finalSecondary.map((categoryId) => ({ supplierId, categoryId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  }

  return data;
}

/** Ensure a submission has all required fields + documents. */
async function assertSubmittable(supplierId: string): Promise<void> {
  const row = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: SUPPLIER_STATE_SELECT,
  });
  if (!row) throw new SupplierRegistrationError('Supplier not found', 404);
  const state = toState(row);
  const errors: ValidationErrors = {};

  if (!state.companyName) errors.companyName = 'Company name is required';
  if (!state.tradeLicenseNumber) errors.tradeLicenseNumber = 'Trade license number is required';
  if (!state.companyType) errors.companyType = 'Company type is required';
  if (!state.country) errors.country = 'Country is required';
  if (!state.emirate) errors.emirate = 'Emirate is required';
  if (!state.city) errors.city = 'City is required';
  if (!state.address) errors.address = 'Address is required';
  if (!state.primaryCategoryId) errors.primaryCategoryId = 'A primary category is required';

  const uploadedTypes = new Set(state.documents.map((d) => d.type));
  const missingDocs = REQUIRED_DOCUMENT_TYPES.filter((t) => !uploadedTypes.has(t));
  if (missingDocs.length > 0) {
    errors.documents = `Missing required documents: ${missingDocs.join(', ')}`;
  }

  const storePhotoCount = state.documents.filter((d) => d.type === 'STORE_PHOTO').length;
  if (storePhotoCount < MIN_STORE_PHOTOS) {
    errors.storePhotos = `Please upload at least ${MIN_STORE_PHOTOS} store photos (${storePhotoCount} uploaded)`;
  }

  if (Object.keys(errors).length > 0) {
    throw new SupplierRegistrationError('Please complete all required fields', 400, errors);
  }
}

/**
 * Apply a (partial) supplier-registration payload. Handles account creation
 * for anonymous Step 1, draft saves for any step, and final submission.
 *
 * @param currentUser  The authenticated user, or null for anonymous Step 1.
 */
export async function applySupplierRegistration(
  currentUser: SessionUser | null,
  payload: SupplierRegisterPayload
): Promise<SupplierRegistrationState> {
  let user = currentUser;
  let supplierId: string;

  if (!user) {
    if (!payload.account) {
      throw new SupplierRegistrationError('Account information is required', 401);
    }
    const created = await createAccount(payload.account);
    user = created.user;
    supplierId = created.supplierId;
  } else {
    if (user.role !== 'SUPPLIER') {
      // Promote a buyer who chose to become a supplier.
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'SUPPLIER', accountType: 'SUPPLIER' },
      });
    }
    supplierId = await ensureSupplierForUser(user);
  }

  // Company + location update.
  const baseUpdate = buildSupplierUpdate(payload);

  // Categories (may run its own transaction for the secondary set).
  const categoryUpdate = payload.categories
    ? await applyCategories(supplierId, payload.categories)
    : {};

  const merged: Prisma.SupplierUpdateInput = { ...baseUpdate, ...categoryUpdate };
  if (Object.keys(merged).length > 0) {
    await prisma.supplier.update({ where: { id: supplierId }, data: merged });
  }

  if (payload.submit) {
    await assertSubmittable(supplierId);

    // Only a DRAFT or a REJECTED application may be (re)submitted. Guarding
    // APPROVED matters: without it an approved supplier who edits their
    // profile and hits submit would fall back to PENDING and silently lose
    // the listing rights granted at approval. PENDING is a no-op (already
    // queued) rather than an error, so a double-click is harmless.
    const current = await prisma.supplier.findUniqueOrThrow({
      where: { id: supplierId },
      select: { onboardingStatus: true },
    });

    if (current.onboardingStatus === 'APPROVED') {
      throw new SupplierRegistrationError(
        'Your application is already approved. Edit your profile from the supplier dashboard.',
        409
      );
    }

    if (current.onboardingStatus !== 'PENDING') {
      await prisma.supplier.update({
        where: { id: supplierId },
        data: { onboardingStatus: 'PENDING' },
      });
      // Fresh review request — a resubmission after a rejection must land in
      // the admin queue again.
      await prisma.supplierVerification.create({
        data: { supplierId, status: 'PENDING' },
      });
    }
  }

  const finalRow = await prisma.supplier.findUniqueOrThrow({
    where: { id: supplierId },
    select: SUPPLIER_STATE_SELECT,
  });
  return toState(finalRow);
}
