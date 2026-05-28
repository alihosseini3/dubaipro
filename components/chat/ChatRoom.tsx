'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

type Message = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
};

type Props = {
  conversationId: string;
  currentUserId: string;
  peer: { id: string; name: string; role: string };
  initialMessages: Message[];
  locale: string;
};

function formatTime(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function ChatRoom({
  conversationId,
  currentUserId,
  peer,
  initialMessages,
  locale
}: Props) {
  const t = useTranslations('chat');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content: trimmed })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(t('errorSend'));
        return;
      }
      const msg = json.data as {
        id: string;
        content: string;
        senderId: string;
        createdAt: string;
        sender: { id: string; name: string };
      };
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          senderName: msg.sender?.name ?? '',
          createdAt: msg.createdAt
        }
      ]);
      setContent('');
    } catch {
      setError(t('errorSend'));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
          {peer.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {peer.name}
          </p>
          <p className="text-xs text-slate-500">{peer.role}</p>
        </div>
      </header>

      <div
        ref={listRef}
        className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-500">
            {t('roomEmpty')}
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={
                    'max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ' +
                    (mine
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200')
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      mine ? 'text-indigo-100' : 'text-slate-400'
                    }`}
                  >
                    {formatTime(m.createdAt, locale)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="flex items-end gap-2 border-t border-slate-200 bg-white p-3"
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e as unknown as React.FormEvent);
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={t('inputPlaceholder')}
          disabled={sending}
          className="max-h-32 min-h-[40px] flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? t('sending') : t('send')}
        </button>
      </form>
    </section>
  );
}
