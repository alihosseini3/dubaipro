/**
 * Supplier registration — shared constants, option lists and pure
 * validation helpers.
 *
 * This module is intentionally framework-agnostic (no `server-only`, no
 * Prisma import) so the exact same option lists and validators can be
 * reused by:
 *   - the client wizard (`/supplier/register`) for inline validation, and
 *   - the API route (`/api/supplier/register`) for authoritative checks.
 */

import type {
  CompanyType,
  SupplierDocumentType,
  SupplierOnboardingStatus,
} from '@prisma/client';

/* ── Company types (Step 2) ─────────────────────────────────────────── */

export const COMPANY_TYPES = [
  'MANUFACTURER',
  'TRADING_COMPANY',
  'DISTRIBUTOR',
  'WHOLESALER',
  'RETAILER',
  'SERVICE_PROVIDER',
] as const satisfies readonly CompanyType[];

export function isCompanyType(v: unknown): v is CompanyType {
  return typeof v === 'string' && (COMPANY_TYPES as readonly string[]).includes(v);
}

/* ── Document types (Step 5) ────────────────────────────────────────── */

export const DOCUMENT_TYPES = [
  'TRADE_LICENSE',
  'PASSPORT',
  'STORE_PHOTO',
  'WAREHOUSE_PHOTO',
  'STORE_VIDEO',
] as const satisfies readonly SupplierDocumentType[];

export function isDocumentType(v: unknown): v is SupplierDocumentType {
  return typeof v === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(v);
}

/** Documents that must be present before a supplier can submit. */
export const REQUIRED_DOCUMENT_TYPES: readonly SupplierDocumentType[] = [
  'TRADE_LICENSE',
  'PASSPORT',
];

/**
 * Gallery types allow multiple files per supplier; everything else is a
 * singleton (re-uploading replaces the existing file).
 */
export const GALLERY_DOCUMENT_TYPES: readonly SupplierDocumentType[] = [
  'STORE_PHOTO',
  'WAREHOUSE_PHOTO',
];

export const VIDEO_DOCUMENT_TYPES: readonly SupplierDocumentType[] = ['STORE_VIDEO'];

export function isGalleryDocumentType(t: SupplierDocumentType): boolean {
  return GALLERY_DOCUMENT_TYPES.includes(t);
}

export function isVideoDocumentType(t: SupplierDocumentType): boolean {
  return VIDEO_DOCUMENT_TYPES.includes(t);
}

/** Per-type maximum number of files the supplier may upload. */
export const DOCUMENT_LIMITS: Record<SupplierDocumentType, number> = {
  TRADE_LICENSE: 1,
  PASSPORT: 1,
  STORE_VIDEO: 1,
  STORE_PHOTO: 12,
  WAREHOUSE_PHOTO: 12,
};

/** Minimum number of store photos required to submit. */
export const MIN_STORE_PHOTOS = 1;

/* ── Location (Step 3) ──────────────────────────────────────────────── */

export const UAE_EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
] as const;

export const DEFAULT_COUNTRY = 'AE';

/* ── File upload rules (Step 5) ─────────────────────────────────────── */

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedDocumentMime = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

const DOC_MIME_TO_EXT: Record<AllowedDocumentMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isAllowedDocumentMime(value: string): value is AllowedDocumentMime {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(value);
}

/* ── Video upload rules (Step 5 — store video) ──────────────────────── */

export const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export type AllowedVideoMime = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

const VIDEO_MIME_TO_EXT: Record<AllowedVideoMime, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export function isAllowedVideoMime(value: string): value is AllowedVideoMime {
  return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(value);
}

export function documentExtensionFor(
  mime: AllowedDocumentMime | AllowedVideoMime
): string {
  if (isAllowedVideoMime(mime)) return VIDEO_MIME_TO_EXT[mime];
  return DOC_MIME_TO_EXT[mime as AllowedDocumentMime];
}

/* ── Password rules (mirrors lib/auth/password.isValidPassword) ─────── */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** E.164-ish: optional +, 7–15 digits. Spaces/dashes stripped first. */
export const PHONE_RE = /^\+?[0-9]{7,15}$/;

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-()]/g, '');
}

export function isValidPhone(raw: unknown): raw is string {
  return typeof raw === 'string' && PHONE_RE.test(normalizePhone(raw));
}

export function isStrongPassword(pw: unknown): pw is string {
  return (
    typeof pw === 'string' &&
    pw.length >= PASSWORD_MIN_LENGTH &&
    pw.length <= PASSWORD_MAX_LENGTH &&
    /[a-zA-Z]/.test(pw) &&
    /[0-9]/.test(pw)
  );
}

/* ── Wire types shared by client + server ───────────────────────────── */

export type AccountInfoInput = {
  name: string;
  email: string;
  /** First entry is the primary login mobile (unique on User). */
  phones: string[];
  password: string;
};

export type CompanyInfoInput = {
  companyName: string;
  tradeName?: string | null;
  tradeLicenseNumber: string;
  companyType: CompanyType;
};

export type LocationInput = {
  country: string;
  emirate: string;
  city: string;
  address: string;
  /** Map-picked coordinates (Leaflet/OSM today, Google Maps-ready). */
  latitude?: number | null;
  longitude?: number | null;
};

export type CategoriesInput = {
  primaryCategoryId: string;
  secondaryCategoryIds: string[];
};

/** Partial payload accepted by POST /api/supplier/register. */
export type SupplierRegisterPayload = {
  account?: Partial<AccountInfoInput>;
  company?: Partial<CompanyInfoInput>;
  location?: Partial<LocationInput>;
  categories?: Partial<CategoriesInput>;
  submit?: boolean;
};

export type SupplierRegistrationDocument = {
  id: string;
  type: SupplierDocumentType;
  fileUrl: string;
  createdAt: string;
};

export type SupplierRegistrationState = {
  supplierId: string;
  onboardingStatus: SupplierOnboardingStatus;
  companyName: string | null;
  tradeName: string | null;
  tradeLicenseNumber: string | null;
  companyType: CompanyType | null;
  phones: string[];
  country: string | null;
  emirate: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryCategoryId: string | null;
  secondaryCategoryIds: string[];
  documents: SupplierRegistrationDocument[];
};
