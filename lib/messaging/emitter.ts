/**
 * In-process EventEmitter for conversation SSE events — same pattern as
 * lib/auctions/emitter.ts (proven in production for auction bids).
 *
 * Single-server deployments work out of the box. For multi-replica
 * deployments, swap the emitter body for a Redis Pub/Sub adapter with the
 * same channel names — REST stays canonical either way, so realtime is
 * purely additive and losing an event only delays a message until the
 * client's fallback poll.
 */
import { EventEmitter } from 'events';

declare global {
  // eslint-disable-next-line no-var
  var __conversationEmitter: EventEmitter | undefined;
}

export const conversationEmitter: EventEmitter =
  (global.__conversationEmitter ??= new EventEmitter());

conversationEmitter.setMaxListeners(1000);

export type ConversationMessageEvent = {
  type: 'message';
  conversationId: string;
  message: {
    id: string;
    senderId: string;
    content: string;
    type: string;
    createdAt: string;
    sender: { id: string; name: string; role: string };
    attachments: {
      id: string;
      url: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }[];
  };
};

export function emitConversationMessage(event: ConversationMessageEvent): void {
  conversationEmitter.emit(`conversation:${event.conversationId}`, event);
}
