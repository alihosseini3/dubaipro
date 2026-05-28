/**
 * RFQ formatting utilities (locale-aware money/number/date).
 */

export function formatMoney(amount: number | null | undefined, currency: string, locale = 'en-US'): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported currency codes (e.g. IRR in some runtimes)
    return `${amount.toLocaleString(locale)} ${currency}`;
  }
}

export function formatNumber(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatRelativeDate(date: Date | string, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86400000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(diffDays) >= 1) return rtf.format(diffDays, 'day');
  const diffHours = Math.round(diffMs / 3600000);
  if (Math.abs(diffHours) >= 1) return rtf.format(diffHours, 'hour');
  const diffMin = Math.round(diffMs / 60000);
  return rtf.format(diffMin, 'minute');
}

export function expiresInDays(expiresAt: Date | string | null): { days: number; expired: boolean } | null {
  if (!expiresAt) return null;
  const d = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return { days: 0, expired: true };
  return { days: Math.ceil(diff / 86400000), expired: false };
}
