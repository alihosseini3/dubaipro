/**
 * Tiny safe interpolator for `{name} {product} {price} {link}` style
 * placeholders. Unknown keys are left intact (no throw) so partially
 * populated payloads still render.
 *
 * Important: values are NOT HTML-escaped here because email bodies are
 * authored as HTML by admins. For WhatsApp, plain text is fine. If we
 * later allow user-generated body fragments, escape at write time.
 */

export type TemplateVars = {
  name?: string;
  product?: string;
  price?: string;
  link?: string;
  [key: string]: string | undefined;
};

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(PLACEHOLDER, (match, key: string) => {
    const v = vars[key];
    return typeof v === 'string' ? v : match;
  });
}
