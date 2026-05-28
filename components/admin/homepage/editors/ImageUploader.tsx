'use client';

import { ImageUpload } from '@/components/ui/ImageUpload';

type Props = {
  /** Current image URL. Empty string = no image yet. */
  value: string;
  /** Called with the new URL after a successful upload, or `''` on remove. */
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  /** Kept for API compatibility — visual ratio is driven by `<ImageUpload>`. */
  aspectRatio?: 'wide' | 'square';
};

/**
 * Thin adapter that delegates to the canonical `<ImageUpload>` so the
 * homepage / auctions builders inherit the same prepare-then-confirm
 * SEO flow used for the product cover image. The legacy contract
 * (`value: string`, `onChange: (url: string) => void`) is preserved.
 */
export function ImageUploader({ value, onChange, label = 'Image', hint }: Props) {
  return (
    <ImageUpload
      label={label}
      hint={hint}
      value={value || null}
      onChange={(url) => onChange(url ?? '')}
      uploadFolder="general"
      uploadContext="banner"
    />
  );
}
