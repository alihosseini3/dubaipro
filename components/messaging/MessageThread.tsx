'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { apiFetch } from '@/lib/api/client';
import { useApiMutation } from '@/hooks/use-api';

type Attachment = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type ThreadMessage = {
  id: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
  attachments: Attachment[];
};

const POLL_INTERVAL_MS = 5000;
/** With a live SSE stream the poll is only a safety net — slow it down. */
const POLL_INTERVAL_SSE_MS = 30000;

/**
 * Message thread with a layered transport:
 *   1. SSE stream (/api/conversations/[id]/stream) pushes messages instantly.
 *   2. `?after=` delta polling stays on as the safety net — every 5s without
 *      SSE, every 30s while the stream is healthy.
 * REST remains the canonical write path. Marks the thread read on mount and
 * whenever new messages land while it is open.
 */
export function MessageThread({
  conversationId,
  viewerId,
  locale,
  archived
}: {
  conversationId: string;
  viewerId: string;
  locale: string;
  archived: boolean;
}) {
  const t = useTranslations('messaging');
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isArchived, setIsArchived] = useState(archived);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);

  const send = useApiMutation<{ content: string }, { data: ThreadMessage }>(
    `/api/conversations/${conversationId}/messages`,
    'POST'
  );
  const archive = useApiMutation<{ archived: boolean }, unknown>(
    `/api/conversations/${conversationId}/archive`,
    'POST'
  );

  const markRead = useCallback(() => {
    void apiFetch(`/api/conversations/${conversationId}/read`, {
      method: 'POST'
    }).catch(() => {});
  }, [conversationId]);

  const appendMessages = useCallback((incoming: ThreadMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return prev;
      const next = [...prev, ...fresh];
      lastTimestampRef.current = next[next.length - 1].createdAt;
      return next;
    });
  }, []);

  /* Initial load */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<{ data: ThreadMessage[] }>(
      `/api/conversations/${conversationId}/messages`
    )
      .then((res) => {
        if (cancelled) return;
        setMessages(res.data);
        lastTimestampRef.current =
          res.data.length > 0 ? res.data[res.data.length - 1].createdAt : null;
        markRead();
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [conversationId, markRead]);

  /* Realtime: SSE stream, purely additive over polling */
  const [sseConnected, setSseConnected] = useState(false);
  useEffect(() => {
    const source = new EventSource(`/api/conversations/${conversationId}/stream`);
    source.addEventListener('open', () => setSseConnected(true));
    source.addEventListener('error', () => setSseConnected(false));
    source.addEventListener('message', (event) => {
      try {
        const message = JSON.parse((event as MessageEvent).data) as ThreadMessage;
        appendMessages([message]);
        markRead();
      } catch {
        /* malformed frame — the fallback poll recovers */
      }
    });
    return () => source.close();
  }, [conversationId, appendMessages, markRead]);

  /* Delta polling — the safety net (slowed down while SSE is healthy) */
  useEffect(() => {
    const timer = setInterval(
      () => {
        const after = lastTimestampRef.current;
        apiFetch<{ data: ThreadMessage[] }>(
          `/api/conversations/${conversationId}/messages`,
          { query: after ? { after } : undefined }
        )
          .then((res) => {
            if (res.data.length > 0) {
              appendMessages(res.data);
              markRead();
            }
          })
          .catch(() => {});
      },
      sseConnected ? POLL_INTERVAL_SSE_MS : POLL_INTERVAL_MS
    );
    return () => clearInterval(timer);
  }, [conversationId, appendMessages, markRead, sseConnected]);

  /* Autoscroll on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const [draft, setDraft] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    try {
      const result = await send.mutate({ content });
      appendMessages([result.data]);
      setDraft('');
    } catch {
      /* send.error rendered below */
    }
  }

  async function toggleArchive() {
    try {
      await archive.mutate({ archived: !isArchived });
      setIsArchived(!isArchived);
    } catch {
      /* archive.error below */
    }
  }

  return (
    <div className="flex h-[65vh] flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
      {/* Toolbar */}
      <div className="flex items-center justify-end border-b border-slate-100 px-3 py-2 dark:border-slate-700">
        <button
          type="button"
          onClick={toggleArchive}
          disabled={archive.loading}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300"
        >
          {isArchived ? t('unarchive') : t('archive')}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-sm text-slate-500">{t('loading')}</p>
        ) : error ? (
          <p className="text-center text-sm text-rose-600">{error}</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500">{t('noMessages')}</p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === viewerId;
            const system = message.type === 'SYSTEM';
            if (system) {
              return (
                <div key={message.id} className="flex justify-center">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    {message.content}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={message.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? 'rounded-ee-sm bg-orange-500 text-white'
                      : 'rounded-es-sm bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[11px] font-bold opacity-70">
                      {message.sender.name}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {message.attachments.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {message.attachments.map((att) => (
                        <li key={att.id}>
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline opacity-90"
                          >
                            📎 {att.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p
                    className={`mt-1 text-end text-[10px] ${
                      mine ? 'text-orange-100' : 'text-slate-400'
                    }`}
                  >
                    {new Date(message.createdAt).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="border-t border-slate-100 p-3 dark:border-slate-700"
      >
        {send.error && (
          <p className="mb-2 text-xs text-rose-600">{send.error.message}</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend(e);
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder={t('composerPlaceholder')}
            className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={send.loading || draft.trim().length === 0}
            className="self-end rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {t('send')}
          </button>
        </div>
      </form>
    </div>
  );
}
