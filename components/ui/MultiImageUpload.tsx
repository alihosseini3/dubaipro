'use client';

/**
 * MultiImageUpload — thin adapter around MultiSmartMediaUploader.
 * Preserves the legacy `value: string[]` / `onChange(urls)` API.
 */

import { MultiSmartMediaUploader } from '@/components/media/MultiSmartMediaUploader';
import type { UploadedAsset } from '@/components/media/SmartMediaUploader';
import type { MediaContext } from '@/lib/media/types';

type Props = {
  value:               string[];
  onChange:            (urls: string[]) => void;
  onUploadingChange?:  (uploading: boolean) => void;
  label?:              string;
  hint?:               string;
  maxItems?:           number;
  className?:          string;
  galleryFolder?:      string;
  uploadFolder?:       string;
  uploadContext?:      MediaContext;
};

function stubAsset(url: string): UploadedAsset {
  return {
    id: url, url, size: 0, width: 0, height: 0,
    format: '', mimeType: '', originalName: '',
    optimizationScore: 0, compressionRatio: 0,
    variants: [], blurDataURL: undefined,
  } as unknown as UploadedAsset;
}

export function MultiImageUpload({
  value,
  onChange,
  onUploadingChange,
  label,
  hint,
  maxItems = 12,
  className,
  galleryFolder,
  uploadFolder,
  uploadContext,
}: Props) {
  return (
    <MultiSmartMediaUploader
      value={value.map(stubAsset)}
      onChange={(assets: UploadedAsset[]) => onChange(assets.map((a) => a.url))}
      onUploadingChange={onUploadingChange}
      label={label}
      hint={hint}
      maxItems={maxItems}
      className={className}
      folder={uploadFolder ?? galleryFolder}
      context={uploadContext}
      showGalleryPicker={!!galleryFolder}
    />
  );
}
