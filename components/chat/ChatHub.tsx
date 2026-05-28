'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export type ChatHubSettings = {
  enableWhatsApp: boolean;
  enableInternalChat: boolean;
  enableContactForm: boolean;
  whatsappPhone: string;
  defaultMessage: string;
};

type Props = {
  locale: string;
  isAuthenticated: boolean;
  settings: ChatHubSettings;
};

type ContactErrors = Partial<Record<'name' | 'email' | 'message', string>>;

function MessageIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function WhatsAppIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden>
      <path d="M19.11 17.22c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.6.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.13-.41-2.15-1.32-.79-.71-1.33-1.58-1.48-1.85-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.6-1.46-.83-2-.22-.53-.44-.46-.6-.47-.16-.01-.34-.01-.52-.01-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27s.97 2.64 1.11 2.82c.14.18 1.92 2.93 4.66 4.11.65.28 1.15.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32zM16.02 5.33c-5.88 0-10.66 4.78-10.66 10.66 0 1.88.49 3.72 1.43 5.34L5 27.67l6.5-1.71c1.56.85 3.32 1.3 5.11 1.3h.01c5.87 0 10.66-4.78 10.66-10.66 0-2.85-1.11-5.53-3.12-7.55a10.6 10.6 0 0 0-7.54-3.12z" />
    </svg>
  );
}

function MailIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 6h16v12H4z" />
      <path d="M4 6l8 7 8-7" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function buildWhatsAppHref(phone: string, message: string): string {
  const digits = phone.replace(/\D+/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || '')}`;
}

/**
 * Single floating entry-point that consolidates every "talk to us" channel.
 * - Renders nothing if every channel is disabled by the admin.
 * - Authenticated users see WhatsApp + Internal Chat.
 * - Guests see WhatsApp + Contact Form (the form posts to /api/contact).
 * - Layout: same edge as the WhatsApp button used to be (`bottom-5 end-5`)
 *   so visitors find it where they expect; we removed the now-redundant
 *   WhatsApp floating button.
 */
export function ChatHub({ locale, isAuthenticated, settings }: Props) {
  const t = useTranslations('chatHub');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'contact'>('menu');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Choices available for this visitor, after admin toggles.
  const showWhatsApp = settings.enableWhatsApp && Boolean(settings.whatsappPhone);
  const showInternal = settings.enableInternalChat && isAuthenticated;
  const showContact = settings.enableContactForm && !isAuthenticated;
  const hasAny = showWhatsApp || showInternal || showContact;

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset to menu whenever the modal opens.
  useEffect(() => {
    if (open) setView('menu');
  }, [open]);

  if (!hasAny) return null;

  const whatsappHref = showWhatsApp
    ? buildWhatsAppHref(settings.whatsappPhone, settings.defaultMessage)
    : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('tooltip')}
        title={t('tooltip')}
        className="group fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] end-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/30 ring-1 ring-white/10 transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400 md:bottom-5 md:h-16 md:w-16"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-slate-900 opacity-50 animate-ping"
        />
        <MessageIcon className="relative h-6 w-6 sm:h-7 sm:w-7" />
        <span className="pointer-events-none absolute bottom-full end-0 mb-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
          {t('tooltip')}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-hub-title"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="chat-hub-title"
                  className="text-base font-semibold text-slate-900"
                >
                  {view === 'contact' ? t('contactTitle') : t('title')}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {view === 'contact'
                    ? t('contactSubtitle')
                    : t('subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="p-5">
              {view === 'menu' ? (
                <ul className="space-y-3">
                  {showInternal && (
                    <li>
                      <Link
                        href={`/${locale}/account/messages`}
                        onClick={() => setOpen(false)}
                        className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                          <MessageIcon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {t('internalTitle')}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {t('internalDescription')}
                          </span>
                        </span>
                      </Link>
                    </li>
                  )}

                  {showWhatsApp && whatsappHref && (
                    <li>
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setOpen(false)}
                        className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <WhatsAppIcon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {t('whatsappTitle')}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {t('whatsappDescription')}
                          </span>
                        </span>
                      </a>
                    </li>
                  )}

                  {showContact && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setView('contact')}
                        className="group flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-start transition hover:border-amber-500 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <MailIcon />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {t('contactTitle')}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {t('contactDescription')}
                          </span>
                        </span>
                      </button>
                    </li>
                  )}
                </ul>
              ) : (
                <ContactForm
                  locale={locale}
                  onClose={() => setOpen(false)}
                  onBack={() => setView('menu')}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ContactForm({
  locale,
  onClose,
  onBack
}: {
  locale: string;
  onClose: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('chatHub');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<ContactErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function clientValidate(): ContactErrors {
    const e: ContactErrors = {};
    if (name.trim().length < 2) e.name = t('errorName');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = t('errorEmail');
    if (message.trim().length < 5) e.message = t('errorMessage');
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const v = clientValidate();
    setErrors(v);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim() || undefined,
          message: message.trim(),
          locale
        })
      });
      if (res.status === 422) {
        // Server-side validation; map back to fields.
        const json = (await res.json().catch(() => ({}))) as {
          details?: Array<{ field: keyof ContactErrors; code: string }>;
        };
        const next: ContactErrors = {};
        for (const it of json.details ?? []) {
          if (it.field === 'name') next.name = t('errorName');
          else if (it.field === 'email') next.email = t('errorEmail');
          else if (it.field === 'message') next.message = t('errorMessage');
        }
        setErrors(next);
        return;
      }
      if (!res.ok) {
        setErrors({ message: t('errorSend') });
        return;
      }
      setDone(true);
    } catch {
      setErrors({ message: t('errorSend') });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <p className="mt-3 text-sm font-semibold text-emerald-800">
          {t('successTitle')}
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          {t('successDescription')}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {t('close')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">
          {t('fieldName')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-rose-700" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">
          {t('fieldEmail')}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          required
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        {errors.email && (
          <p className="mt-1 text-xs text-rose-700" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">
          {t('fieldSubject')}
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">
          {t('fieldMessage')}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4000}
          required
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        {errors.message && (
          <p className="mt-1 text-xs text-rose-700" role="alert">
            {errors.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
        >
          {t('back')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t('sending') : t('send')}
        </button>
      </div>
    </form>
  );
}
