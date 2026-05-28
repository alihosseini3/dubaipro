'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  userId: string | null;
  status: string;
  createdAt: Date | string;
  replyContent: string | null;
  replySentAt: Date | string | null;
  conversationId: string | null;
}

interface Props {
  message: ContactMessage;
  locale: string;
}

export function ContactMessageRow({ message, locale }: Props) {
  const t = useTranslations('admin.messages');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(message.replyContent ?? '');
  const [createChat, setCreateChat] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isReplied = !!message.replySentAt;
  const createdLabel = new Date(message.createdAt)
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/admin/messages/contact/${message.id}/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ replyContent: reply, createChat })
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          type: 'error',
          text: json.error || t('replyError')
        });
        return;
      }
      const emailSent = json.data?.emailSent;
      const chatCreated = json.data?.chatCreated;
      setFeedback({
        type: 'success',
        text: `${t('replySuccess')}${emailSent ? ` ✓ ${t('emailSentLabel')}` : ` ⚠ ${t('emailFailedLabel')}`}${chatCreated ? ` ✓ ${t('chatCreatedLabel')}` : ''}`
      });
      router.refresh();
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setFeedback({ type: 'error', text: t('replyError') });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <tr
        className={`cursor-pointer align-top transition-colors hover:bg-slate-50 ${
          isReplied ? 'bg-emerald-50/40' : ''
        }`}
        onClick={() => setOpen(true)}
      >
        <td className="px-4 py-3">
          <p className="font-medium text-slate-900">{message.name}</p>
          {message.subject && (
            <p className="mt-0.5 text-xs text-slate-500">{message.subject}</p>
          )}
          {isReplied && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              ✓ {t('repliedBadge')}
            </span>
          )}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-slate-700">
          {message.email}
        </td>
        <td className="px-4 py-3 text-slate-700">
          <p className="line-clamp-2 max-w-md break-words">{message.message}</p>
        </td>
        <td className="px-4 py-3 tabular-nums text-slate-600">
          {createdLabel}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={4} className="bg-slate-50 p-0">
            <Modal
              message={message}
              reply={reply}
              setReply={setReply}
              createChat={createChat}
              setCreateChat={setCreateChat}
              sending={sending}
              feedback={feedback}
              onClose={() => setOpen(false)}
              onSubmit={handleSubmit}
              locale={locale}
              t={t}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function Modal({
  message,
  reply,
  setReply,
  createChat,
  setCreateChat,
  sending,
  feedback,
  onClose,
  onSubmit,
  t
}: {
  message: ContactMessage;
  reply: string;
  setReply: (v: string) => void;
  createChat: boolean;
  setCreateChat: (v: boolean) => void;
  sending: boolean;
  feedback: { type: 'success' | 'error'; text: string } | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t('replyTitle')}
            </h2>
            <p className="text-xs text-slate-500">
              {message.name} · {message.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('originalMessageLabel')}
            </h3>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {message.subject && (
                <p className="mb-2 font-medium">{message.subject}</p>
              )}
              <p className="whitespace-pre-wrap break-words">
                {message.message}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                {new Date(message.createdAt).toLocaleString()}
              </p>
            </div>
          </section>

          {message.replyContent && message.replySentAt && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {t('previousReplyLabel')}
              </h3>
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
                <p className="whitespace-pre-wrap break-words">
                  {message.replyContent}
                </p>
                <p className="mt-2 text-[11px] text-emerald-600">
                  {new Date(message.replySentAt).toLocaleString()}
                </p>
              </div>
            </section>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="reply"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {t('replyLabel')}
              </label>
              <textarea
                id="reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={6}
                required
                placeholder={t('replyPlaceholder')}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {message.userId && (
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={createChat}
                  onChange={(e) => setCreateChat(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                />
                <span>
                  <span className="font-medium">{t('createChatLabel')}</span>
                  <span className="block text-xs text-slate-500">
                    {t('createChatHint')}
                  </span>
                </span>
              </label>
            )}

            {feedback && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {feedback.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {t('cancelButton')}
              </button>
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? t('sendingButton') : t('sendReplyButton')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
