import { getCurrentUser } from '@/lib/auth/session';
import { getWhatsAppSettings } from '@/lib/whatsapp/service';

import { ChatHub } from './ChatHub';

type Props = { locale: string };

/**
 * Server wrapper that resolves the chat-hub configuration once per request
 * and hands a sanitized DTO to the client modal. Authentication state and
 * admin toggles are decided here so the markup never leaks privileged data.
 */
export async function FloatingChatHubButton({ locale }: Props) {
  const [user, settings] = await Promise.all([
    getCurrentUser().catch(() => null),
    getWhatsAppSettings().catch(() => null)
  ]);

  if (!settings) return null;

  const enableWhatsApp =
    settings.isEnabled &&
    settings.showFloating &&
    settings.phone.replace(/\D+/g, '').length >= 7;

  return (
    <ChatHub
      locale={locale}
      isAuthenticated={Boolean(user)}
      settings={{
        enableWhatsApp,
        enableInternalChat: settings.enableInternalChat,
        enableContactForm: settings.enableContactForm,
        whatsappPhone: settings.phone,
        defaultMessage: settings.defaultMessage
      }}
    />
  );
}
