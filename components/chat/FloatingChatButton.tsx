import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/lib/auth/session';

type Props = { locale: string };

/**
 * Global floating internal-chat button.
 * - Visible to EVERY visitor (guests + all authenticated roles).
 * - Logged-in users land directly on their inbox.
 * - Guests are routed to `/login?from=/account/messages`; the messages
 *   page itself is gated by `requireUser`, so authentication is enforced
 *   server-side and we never expose private data to anonymous visitors.
 * - Stacked above the WhatsApp button on the same edge (`bottom-24`) so
 *   the two CTAs never overlap on mobile or desktop.
 * - Dark slate fill clearly distinguishes it from the green WhatsApp CTA.
 */
export async function FloatingChatButton({ locale }: Props) {
  const user = await getCurrentUser();
  const t = await getTranslations({ locale, namespace: 'chat' });
  const label = t('floatingTooltip');
  const href = user
    ? `/${locale}/account/messages`
    : `/${locale}/login?from=${encodeURIComponent(`/${locale}/account/messages`)}`;

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="group fixed bottom-24 end-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/30 ring-1 ring-white/10 transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400 sm:h-14 sm:w-14"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 sm:h-7 sm:w-7"
        aria-hidden
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="pointer-events-none absolute bottom-full end-0 mb-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
        {label}
      </span>
    </Link>
  );
}
