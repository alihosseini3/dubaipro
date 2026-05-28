'use client';

import { create } from 'zustand';

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info';
  msg: string;
  durationMs?: number;
}

interface RfqUiState {
  /* ── Inbox badge ─────────────────────────────────────────── */
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  incrementUnread: () => void;

  /* ── Toast queue ─────────────────────────────────────────── */
  toasts: Toast[];
  addToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  /* ── Active chat context ─────────────────────────────────── */
  activeChatRfqSlug: string | null;
  activeChatQuoteId: string | null;
  openChat: (rfqSlug: string, quoteId?: string) => void;
  closeChat: () => void;

  /* ── Realtime connection health ──────────────────────────── */
  sseConnected: boolean;
  setSseConnected: (v: boolean) => void;
}

let toastSeq = 0;

export const useRfqUiStore = create<RfqUiState>((set) => ({
  /* ── Inbox badge ─────────────────────────────────────────── */
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),

  /* ── Toast queue ─────────────────────────────────────────── */
  toasts: [],
  addToast: (t) => {
    const id = `toast-${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    const dur = t.durationMs ?? 3500;
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), dur);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  /* ── Active chat context ─────────────────────────────────── */
  activeChatRfqSlug: null,
  activeChatQuoteId: null,
  openChat: (rfqSlug, quoteId) => set({ activeChatRfqSlug: rfqSlug, activeChatQuoteId: quoteId ?? null }),
  closeChat: () => set({ activeChatRfqSlug: null, activeChatQuoteId: null }),

  /* ── SSE health ──────────────────────────────────────────── */
  sseConnected: false,
  setSseConnected: (v) => set({ sseConnected: v }),
}));
