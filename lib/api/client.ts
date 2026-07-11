/**
 * Typed fetch client for calling our own /api routes from client components.
 * Replaces the copy-pasted `fetch('/api/…')` + manual JSON/error handling
 * pattern. Isomorphic (no server-only imports) but intended for the browser.
 *
 * Error contract mirrors lib/api/errors.ts responses:
 *   { error: string, details?: Record<string, string> }
 */

export class ApiError extends Error {
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON-serialised as the request body. */
  body?: unknown;
  /** Appended as search params; null/undefined entries are skipped. */
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, query, signal, headers } = options;

  let url = path;
  if (query) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) search.set(key, String(value));
    }
    const qs = search.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Network error');
  }

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    const details =
      payload && typeof payload.details === 'object' && payload.details !== null
        ? (payload.details as Record<string, string>)
        : undefined;
    throw new ApiError(response.status, message, details);
  }

  return payload as T;
}
