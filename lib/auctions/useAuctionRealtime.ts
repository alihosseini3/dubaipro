'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { AuctionBidEvent, AuctionWatchEvent } from '@/lib/auctions/emitter';

type Handlers = {
  onBid?: (event: AuctionBidEvent) => void;
  onWatch?: (event: AuctionWatchEvent) => void;
};

export function useAuctionRealtime(auctionId: string, enabled: boolean, handlers: Handlers) {
  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let socket: Socket | null = null;
    let usingSocket = false;

    try {
      socket = io('/', {
        path: '/api/socket/io',
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 2,
        timeout: 1500,
      });

      socket.on('connect', () => {
        usingSocket = true;
        socket?.emit('auction:join', auctionId);
      });
      socket.on(`auction:${auctionId}:bid`, (event: AuctionBidEvent) => handlers.onBid?.(event));
      socket.on(`auction:${auctionId}:watch`, (event: AuctionWatchEvent) => handlers.onWatch?.(event));
      socket.on('connect_error', startSseFallback);
      socket.on('disconnect', () => {
        if (!usingSocket) startSseFallback();
      });
    } catch {
      startSseFallback();
    }

    const fallbackTimer = window.setTimeout(() => {
      if (!usingSocket) startSseFallback();
    }, 1800);

    function startSseFallback() {
      if (es) return;
      es = new EventSource(`/api/auctions/${auctionId}/stream`);
      es.addEventListener('bid', (event) => handlers.onBid?.(JSON.parse(event.data) as AuctionBidEvent));
      es.addEventListener('watch', (event) => handlers.onWatch?.(JSON.parse(event.data) as AuctionWatchEvent));
    }

    return () => {
      window.clearTimeout(fallbackTimer);
      es?.close();
      if (socket) {
        socket.emit('auction:leave', auctionId);
        socket.disconnect();
      }
    };
  }, [auctionId, enabled, handlers]);
}
