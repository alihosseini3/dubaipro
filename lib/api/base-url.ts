import { headers } from 'next/headers';

/**
 * Build the absolute base URL for the current request (useful for server-side
 * fetches to internal route handlers).
 */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host =
    h.get('x-forwarded-host') ??
    h.get('host') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'localhost:3000';
  const protocol =
    h.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https');
  return `${protocol}://${host}`;
}
