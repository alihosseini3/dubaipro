/**
 * Outbound WhatsApp messaging.
 *
 * We support two modes:
 *  1. Cloud API (Meta) — set WHATSAPP_API_URL + WHATSAPP_API_TOKEN +
 *     WHATSAPP_PHONE_ID. POSTs to Graph endpoint with a text message.
 *  2. Disabled — when env vars are missing we return `success: false`
 *     with a clear reason so the dispatcher can log SKIPPED instead of
 *     crashing in dev.
 *
 * Callers must pass an E.164 phone (e.g. "971501234567"). We strip
 * any non-digits before sending.
 */

const API_URL = process.env.WHATSAPP_API_URL?.trim() || '';
const API_TOKEN = process.env.WHATSAPP_API_TOKEN?.trim() || '';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID?.trim() || '';

function digitsOnly(raw: string): string {
  return (raw ?? '').replace(/\D+/g, '');
}

export async function sendWhatsAppMessage(params: {
  to: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  const to = digitsOnly(params.to);
  if (!to) return { success: false, error: 'invalid phone' };
  if (!params.body?.trim()) return { success: false, error: 'empty body' };
  if (!API_URL || !API_TOKEN || !PHONE_ID) {
    return { success: false, error: 'whatsapp_not_configured' };
  }

  try {
    const url = `${API_URL.replace(/\/+$/, '')}/${encodeURIComponent(PHONE_ID)}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: params.body.slice(0, 4096) }
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: `status ${res.status}: ${text.slice(0, 200)}` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'unknown error'
    };
  }
}
