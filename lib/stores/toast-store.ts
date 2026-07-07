'use client';

import { create } from 'zustand';

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info';
  msg: string;
  durationMs?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

let toastSeq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (t) => {
    const id = `toast-${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    const dur = t.durationMs ?? 3500;
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), dur);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
