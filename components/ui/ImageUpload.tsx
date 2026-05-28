'use client';

/**
 * ImageUpload — thin adapter around SmartMediaUploader.
 * Preserves the legacy `value: string | null` / `onChange(url)` API.
 */

import { SmartMediaUploader, type UploadedAsset } from '@/components/media/SmartMediaUploader';
import type { MediaContext } from '@/lib/media/types';

type ImageUploadProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  label?: string;
  hint?: string;
  className?: string;
  galleryFolder?: string;
  uploadFolder?: string;
  uploadContext?: MediaContext;
  /** @deprecated no-op kept for API compat */
  altSuggestion?: string;
};

/** Build a minimal UploadedAsset stub from a plain URL (legacy value). */
function stubAsset(url: string): UploadedAsset {
  return {
    id: url, url, size: 0, width: 0, height: 0,
    format: '', mimeType: '', originalName: '',
    optimizationScore: 0, compressionRatio: 0,
    variants: [], blurDataURL: undefined,
  } as unknown as UploadedAsset;
}

export function ImageUpload({
  value,
  onChange,
  onUploadingChange,
  label,
  hint,
  className,
  galleryFolder,
  uploadFolder,
  uploadContext,
  altSuggestion,
}: ImageUploadProps) {
  return (
    <SmartMediaUploader
      value={value ? stubAsset(value) : null}
      onChange={(asset) => onChange(asset?.url ?? null)}
      onUploadingChange={onUploadingChange}
      label={label}
      hint={hint}
      className={className}
      folder={uploadFolder ?? galleryFolder}
      context={uploadContext}
      altSuggestion={altSuggestion}
      showGalleryPicker={!!galleryFolder}
    />
  );
}

