/**
 * In-process EventEmitter for auction SSE events.
 *
 * Single-server deployments (Docker / Node PM2) work out of the box.
 * For multi-replica deployments (Vercel, Kubernetes), replace the
 * emitter body with a Redis Pub/Sub adapter (e.g. ioredis subscriber)
 * that fans out to the same channel name.
 */
import { EventEmitter } from 'events';

declare global {
  // eslint-disable-next-line no-var
  var __auctionEmitter: EventEmitter | undefined;
}

export const auctionEmitter: EventEmitter =
  (global.__auctionEmitter ??= new EventEmitter());

auctionEmitter.setMaxListeners(1000);

export type AuctionBidEvent = {
  type: 'bid';
  auctionId: string;
  currentBid: number;
  bidderInitial: string;
  endsAt: string;
  totalBids: number;
  reserveMet: boolean;
};

export type AuctionWatchEvent = {
  type: 'watch';
  auctionId: string;
  watcherCount: number;
};

export type AuctionEvent = AuctionBidEvent | AuctionWatchEvent;

export function emitAuctionBid(event: AuctionBidEvent): void {
  auctionEmitter.emit(`auction:${event.auctionId}`, event);
}

export function emitAuctionWatch(event: AuctionWatchEvent): void {
  auctionEmitter.emit(`auction:${event.auctionId}`, event);
}
