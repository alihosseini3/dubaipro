'use client';

import { useEffect } from 'react';
import { useRfqUiStore } from '@/lib/stores/rfq-ui-store';

export type SseEvent =
  | { type: 'connected' }
  | { type: 'heartbeat' }
  | { type: 'new_message' }
  | { type: 'status_changed'; status: string }
  | { type: 'quote_update'; count: number };

/**
 * Opens an SSE connection to /api/rfq/[slug]/events.
 * Calls `onEvent` on each meaningful event.
 * Auto-reconnects with exponential backoff on disconnect.
 */
export function useRfqSse(rfqSlug: string, onEvent: (e: SseEvent) => void) {
  const setSseConnected = useRfqUiStore((s) => s.setSseConnected);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryDelay = 2000;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      es = new EventSource(`/api/rfq/requests/${rfqSlug}/events`);

      es.onopen = () => {
        setSseConnected(true);
        retryDelay = 2000;
      };

      es.onmessage = (e) => {
        try {
          onEvent(JSON.parse(e.data) as SseEvent);
        } catch { /* malformed */ }
      };

      es.onerror = () => {
        setSseConnected(false);
        es?.close();
        if (!destroyed) {
          setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30000);
            connect();
          }, retryDelay);
        }
      };
    }

    connect();
    return () => {
      destroyed = true;
      setSseConnected(false);
      es?.close();
    };
  }, [rfqSlug, onEvent, setSseConnected]);
}
