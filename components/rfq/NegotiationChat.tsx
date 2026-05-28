'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { RfqMessageDTO } from '@/lib/rfq/types';
import { useRfqSse } from '@/hooks/use-rfq-sse';

type Props = {
  rfqSlug: string;
  currentUserId: string;
  quoteId?: string;
};

export function NegotiationChat({ rfqSlug, currentUserId, quoteId }: Props) {
  const t = useTranslations('rfqMarketplace.chat');
  const [messages, setMessages] = useState<RfqMessageDTO[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const base = `/api/rfq/requests/${rfqSlug}/messages`;
  const url = quoteId ? `${base}?quoteId=${quoteId}` : base;

  const fetchMessages = useCallback(() => {
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setMessages(j.data);
      })
      .catch(() => null);
  }, [url]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((j) => setMessages(j.data ?? []))
      .catch(() => setError(t('errLoad')))
      .finally(() => setLoading(false));
  }, [url, t]);

  // SSE — re-fetch only when server pushes new_message
  useRfqSse(rfqSlug, useCallback((e) => {
    if (e.type === 'new_message') fetchMessages();
  }, [fetchMessages]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!content.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), quoteId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'send_failed');
      setMessages((prev) => [...prev, j.data]);
      setContent('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errSend'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Messages list */}
      <div className="flex max-h-[400px] min-h-[200px] flex-col gap-3 overflow-y-auto p-4">
        {loading && (
          <p className="text-xs text-slate-400">{t('loading')}</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-slate-400">{t('empty')}</p>
        )}
        {messages.map((m) => {
          const isMine = m.senderId === currentUserId;
          return (
            <div
              key={m.id}
              className={`flex max-w-[80%] flex-col gap-1 ${isMine ? 'ms-auto items-end' : 'items-start'}`}
            >
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm ${
                  isMine
                    ? 'rounded-br-sm bg-orange-500 text-white'
                    : 'rounded-bl-sm bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </div>
              {m.attachmentUrl && (
                <a
                  href={m.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-[11px] underline ${isMine ? 'text-orange-200' : 'text-blue-500'}`}
                >
                  {t('attachment')}
                </a>
              )}
              <p className="text-[10px] text-slate-400">
                {isMine ? t('you') : m.senderName} ·{' '}
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {error && (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2 border-t border-slate-100 p-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t('placeholder')}
          rows={2}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
        />
        <button
          onClick={send}
          disabled={sending || !content.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white transition hover:bg-orange-600 disabled:opacity-40"
          aria-label="Send"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
