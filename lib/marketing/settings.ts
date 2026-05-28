import 'server-only';

import { cache } from 'react';

import { prisma } from '@/lib/prisma';

export type PublicMarketingSettings = {
  trackingEnabled: boolean;
  googleAdsId: string | null;
  googleConvLabel: string | null;
  metaPixelId: string | null;
  /** Boolean flag — never the raw token. */
  metaAccessTokenSet: boolean;
  metaTestEventCode: string | null;
  ga4MeasurementId: string | null;
  /** Boolean flag — never the raw secret. */
  ga4ApiSecretSet: boolean;
  requireConsent: boolean;
};

const SINGLETON_ID = 'default';

/**
 * Read the marketing settings singleton.
 *
 * Wrapped in `react.cache()` so multiple components in the same render
 * (layout + pixel injector + page) share one DB hit. Returns safe
 * defaults when the row is missing — useful in fresh installs before
 * the migration's seed has run.
 */
export const getMarketingSettings = cache(
  async function getMarketingSettings(): Promise<PublicMarketingSettings> {
    try {
      const row = await prisma.marketingSettings.findUnique({
        where: { id: SINGLETON_ID }
      });
      if (!row) return DEFAULTS;
      return {
        trackingEnabled: row.trackingEnabled,
        googleAdsId: row.googleAdsId,
        googleConvLabel: row.googleConvLabel,
        metaPixelId: row.metaPixelId,
        metaAccessTokenSet: Boolean(row.metaAccessToken),
        metaTestEventCode: row.metaTestEventCode,
        ga4MeasurementId: row.ga4MeasurementId,
        ga4ApiSecretSet: Boolean(row.ga4ApiSecret),
        requireConsent: row.requireConsent
      };
    } catch {
      // Don't crash the public site because the marketing table is
      // unavailable — just degrade to "no tracking".
      return DEFAULTS;
    }
  }
);

const DEFAULTS: PublicMarketingSettings = {
  trackingEnabled: false,
  googleAdsId: null,
  googleConvLabel: null,
  metaPixelId: null,
  metaAccessTokenSet: false,
  metaTestEventCode: null,
  ga4MeasurementId: null,
  ga4ApiSecretSet: false,
  requireConsent: true
};

export type MarketingSettingsUpdate = Partial<{
  trackingEnabled: boolean;
  googleAdsId: string | null;
  googleConvLabel: string | null;
  metaPixelId: string | null;
  /** Empty string = no change. null = clear. */
  metaAccessToken: string | null;
  metaTestEventCode: string | null;
  ga4MeasurementId: string | null;
  /** Empty string = no change. null = clear. */
  ga4ApiSecret: string | null;
  requireConsent: boolean;
}>;

const GOOGLE_ID_RE = /^(AW|G|GT|GTM)-[A-Z0-9-]{4,40}$/i;
const GA4_ID_RE = /^G-[A-Z0-9]{4,20}$/i;
const META_ID_RE = /^[0-9]{6,20}$/;

export type ValidationIssue = { field: string; message: string };

export type UpdateResult =
  | { ok: true; settings: PublicMarketingSettings }
  | { ok: false; issues: ValidationIssue[] };

/**
 * Apply a partial update with light format validation. Pixel IDs are
 * checked against well-known prefixes so a typo doesn't silently break
 * tracking — but we don't try to verify the pixel actually exists at
 * Google/Meta (that would require API credentials and is fragile).
 */
export async function updateMarketingSettings(
  patch: MarketingSettingsUpdate
): Promise<UpdateResult> {
  const issues: ValidationIssue[] = [];

  if (patch.googleAdsId != null && patch.googleAdsId !== '') {
    if (!GOOGLE_ID_RE.test(patch.googleAdsId)) {
      issues.push({ field: 'googleAdsId', message: 'invalid format (expected AW-… / G-… / GTM-…)' });
    }
  }
  if (patch.metaPixelId != null && patch.metaPixelId !== '') {
    if (!META_ID_RE.test(patch.metaPixelId)) {
      issues.push({ field: 'metaPixelId', message: 'invalid format (expected 6-20 digits)' });
    }
  }
  if (patch.ga4MeasurementId != null && patch.ga4MeasurementId !== '') {
    if (!GA4_ID_RE.test(patch.ga4MeasurementId)) {
      issues.push({
        field: 'ga4MeasurementId',
        message: 'invalid format (expected G-XXXXXXX)'
      });
    }
  }
  if (
    patch.trackingEnabled === true &&
    !patch.googleAdsId &&
    !patch.metaPixelId
  ) {
    // Allow enabling without IDs only if at least one ID is already
    // persisted. We compute that off the existing row.
    const existing = await prisma.marketingSettings
      .findUnique({ where: { id: SINGLETON_ID } })
      .catch(() => null);
    if (!existing?.googleAdsId && !existing?.metaPixelId) {
      issues.push({
        field: 'trackingEnabled',
        message: 'configure at least one pixel before enabling'
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const data: Record<string, unknown> = {};
  if (patch.trackingEnabled !== undefined) data.trackingEnabled = patch.trackingEnabled;
  if (patch.googleAdsId !== undefined) data.googleAdsId = emptyToNull(patch.googleAdsId);
  if (patch.googleConvLabel !== undefined) data.googleConvLabel = emptyToNull(patch.googleConvLabel);
  if (patch.metaPixelId !== undefined) data.metaPixelId = emptyToNull(patch.metaPixelId);
  if (patch.ga4MeasurementId !== undefined) data.ga4MeasurementId = emptyToNull(patch.ga4MeasurementId);
  if (patch.metaTestEventCode !== undefined) data.metaTestEventCode = emptyToNull(patch.metaTestEventCode);
  // Secrets: empty string means "no change" (preserve existing). null
  // explicitly clears. Non-empty replaces.
  if (patch.metaAccessToken !== undefined && patch.metaAccessToken !== '') {
    data.metaAccessToken = patch.metaAccessToken;
  }
  if (patch.ga4ApiSecret !== undefined && patch.ga4ApiSecret !== '') {
    data.ga4ApiSecret = patch.ga4ApiSecret;
  }
  if (patch.requireConsent !== undefined) data.requireConsent = patch.requireConsent;

  const row = await prisma.marketingSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data
  });

  return {
    ok: true,
    settings: {
      trackingEnabled: row.trackingEnabled,
      googleAdsId: row.googleAdsId,
      googleConvLabel: row.googleConvLabel,
      metaPixelId: row.metaPixelId,
      metaAccessTokenSet: Boolean(row.metaAccessToken),
      metaTestEventCode: row.metaTestEventCode,
      ga4MeasurementId: row.ga4MeasurementId,
      ga4ApiSecretSet: Boolean(row.ga4ApiSecret),
      requireConsent: row.requireConsent
    }
  };
}

function emptyToNull(v: string | null): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}
