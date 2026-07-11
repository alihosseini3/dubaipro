'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch, ApiError, type ApiFetchOptions } from '@/lib/api/client';

/**
 * Thin data hooks over `apiFetch` for client components. Deliberately not a
 * cache layer (no react-query in this repo) — just the loading/error/JSON
 * boilerplate that is currently re-implemented around raw `fetch()` calls.
 */

export type ApiQueryState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** Re-runs the request (e.g. after a mutation). */
  refetch: () => void;
};

/**
 * GET a JSON endpoint on mount and whenever `path`/`query` change.
 * Pass `enabled: false` to hold the request (e.g. until an id is known).
 */
export function useApiQuery<T>(
  path: string,
  options: { query?: ApiFetchOptions['query']; enabled?: boolean } = {}
): ApiQueryState<T> {
  const { query, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [tick, setTick] = useState(0);
  const queryKey = JSON.stringify(query ?? null);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    apiFetch<T>(path, { query: queryRef.current, signal: controller.signal })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err : new ApiError(0, 'Network error'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, queryKey, enabled, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, refetch };
}

export type ApiMutationState<TInput, TOutput> = {
  mutate: (input: TInput) => Promise<TOutput>;
  error: ApiError | null;
  loading: boolean;
  reset: () => void;
};

/**
 * Wraps a mutating endpoint. `mutate` resolves with the response body and
 * rejects with `ApiError` (also exposed via state for inline rendering).
 *
 *   const { mutate, loading, error } = useApiMutation<CreateBody, Product>(
 *     '/api/supplier/products', 'POST'
 *   );
 */
export function useApiMutation<TInput, TOutput>(
  path: string | ((input: TInput) => string),
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
): ApiMutationState<TInput, TOutput> {
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput> => {
      setLoading(true);
      setError(null);
      try {
        const url = typeof path === 'function' ? path(input) : path;
        return await apiFetch<TOutput>(url, {
          method,
          body: method === 'DELETE' && input === undefined ? undefined : input
        });
      } catch (err) {
        const apiError =
          err instanceof ApiError ? err : new ApiError(0, 'Network error');
        setError(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [path, method]
  );

  const reset = useCallback(() => setError(null), []);

  return { mutate, error, loading, reset };
}
