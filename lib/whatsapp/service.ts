import { prisma } from '@/lib/prisma';

export type WhatsAppSettingsDTO = {
  phone: string;
  defaultMessage: string;
  isEnabled: boolean;
  showFloating: boolean;
  showOnProduct: boolean;
  enableInternalChat: boolean;
  enableContactForm: boolean;
};

const SINGLETON_ID = 'singleton';

const DEFAULTS: WhatsAppSettingsDTO = {
  phone: '',
  defaultMessage: '',
  isEnabled: false,
  showFloating: true,
  showOnProduct: true,
  enableInternalChat: true,
  enableContactForm: true
};

/** Read-only digits for wa.me links. */
export function normalizePhone(raw: string): string {
  return (raw ?? '').replace(/\D+/g, '');
}

export async function getWhatsAppSettings(): Promise<WhatsAppSettingsDTO> {
  const row = await prisma.whatsAppSettings.findUnique({
    where: { id: SINGLETON_ID }
  });
  if (!row) return DEFAULTS;
  return {
    phone: row.phone,
    defaultMessage: row.defaultMessage,
    isEnabled: row.isEnabled,
    showFloating: row.showFloating,
    showOnProduct: row.showOnProduct,
    enableInternalChat: row.enableInternalChat,
    enableContactForm: row.enableContactForm
  };
}

export async function updateWhatsAppSettings(
  input: Partial<WhatsAppSettingsDTO>
): Promise<WhatsAppSettingsDTO> {
  const data: Partial<WhatsAppSettingsDTO> = {};

  if (input.phone !== undefined) data.phone = normalizePhone(input.phone);
  if (input.defaultMessage !== undefined)
    data.defaultMessage = String(input.defaultMessage).slice(0, 1000);
  if (input.isEnabled !== undefined) data.isEnabled = !!input.isEnabled;
  if (input.showFloating !== undefined) data.showFloating = !!input.showFloating;
  if (input.showOnProduct !== undefined)
    data.showOnProduct = !!input.showOnProduct;
  if (input.enableInternalChat !== undefined)
    data.enableInternalChat = !!input.enableInternalChat;
  if (input.enableContactForm !== undefined)
    data.enableContactForm = !!input.enableContactForm;

  const row = await prisma.whatsAppSettings.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: {
      id: SINGLETON_ID,
      phone: data.phone ?? DEFAULTS.phone,
      defaultMessage: data.defaultMessage ?? DEFAULTS.defaultMessage,
      isEnabled: data.isEnabled ?? DEFAULTS.isEnabled,
      showFloating: data.showFloating ?? DEFAULTS.showFloating,
      showOnProduct: data.showOnProduct ?? DEFAULTS.showOnProduct,
      enableInternalChat:
        data.enableInternalChat ?? DEFAULTS.enableInternalChat,
      enableContactForm:
        data.enableContactForm ?? DEFAULTS.enableContactForm
    }
  });

  return {
    phone: row.phone,
    defaultMessage: row.defaultMessage,
    isEnabled: row.isEnabled,
    showFloating: row.showFloating,
    showOnProduct: row.showOnProduct,
    enableInternalChat: row.enableInternalChat,
    enableContactForm: row.enableContactForm
  };
}
