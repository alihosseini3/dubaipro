/**
 * SmartImage — production-grade responsive image component.
 *
 * Two modes:
 *
 * 1. Legacy mode (src + optional thumbnailUrl):
 *    Works exactly as before — generates a simple srcset of two sizes.
 *    All existing call sites continue to work unchanged.
 *
 * 2. Smart mode (src + variants array):
 *    Renders a <picture> element with:
 *      - <source type="image/avif" srcset="..." sizes="...">
 *      - <source type="image/webp" srcset="..." sizes="...">
 *      - <source type="image/jpeg" srcset="..." sizes="...">
 *      - <img> fallback with CSS-only LQIP blur-up + dominant-color skeleton
 *
 * LQIP blur-up: blurDataURL is set as CSS background-image on the <img>.
 * Before the real image loads the browser renders the blurred placeholder;
 * once the real pixels arrive they cover it — zero JS required.
 *
 * DPR / retina: handled natively by the browser through `w` descriptors
 * combined with `sizes`. The browser selects the smallest variant that
 * meets the physical pixel requirement (e.g. 2× retina picks the 2× bucket).
 *
 * LCP optimisation: pass `loading="eager"` (or `priority`) to set
 * fetchpriority="high" automatically.
 */

import type { CSSProperties, ImgHTMLAttributes } from 'react';

import type { RenderedVariant } from '@/lib/media/types';
import { buildSrcSet, buildSizes, getVariantUrl } from '@/lib/media/srcset';

/* ─────────────────────────────────────────────────────────────────────────── */
/* Props                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

type BaseProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'srcSet' | 'src'> & {
  alt: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'auto' | 'sync';
};

type LegacyProps = BaseProps & {
  src: string;
  /** 400px WebP thumbnail generated at upload time (legacy mode). */
  thumbnailUrl?: string | null;
  /** Breakpoint below which thumbnail is used (legacy, default 640px). */
  thumbBreakpoint?: number;
  variants?: never;
  blurDataURL?: never;
  dominantColor?: never;
  context?: never;
  /** Custom sizes string. Also accepted in legacy mode for explicit srcset breakpoints. */
  sizes?: string;
};

type SmartProps = BaseProps & {
  /** Master/fallback URL. */
  src: string;
  /** Full variant ladder from MediaAsset.variants. */
  variants: RenderedVariant[];
  /** Base64 LQIP for blur-up effect. */
  blurDataURL?: string | null;
  /** Dominant color hex (#RRGGBB) for skeleton background. */
  dominantColor?: string | null;
  /** MediaContext key for automatic sizes string. */
  context?: string | null;
  /** Custom sizes string (overrides context). */
  sizes?: string;
  thumbnailUrl?: never;
  thumbBreakpoint?: never;
};

export type SmartImageProps = LegacyProps | SmartProps;

/* ─────────────────────────────────────────────────────────────────────────── */
/* Component                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export function SmartImage(props: SmartImageProps) {
  const { loading = 'lazy', decoding = 'async', alt } = props;

  // ── Smart mode ────────────────────────────────────────────────────────
  if ('variants' in props && Array.isArray(props.variants) && props.variants.length > 0) {
    const { src, variants, blurDataURL, dominantColor, context, sizes: sizesProp, ...rest } = props;
    delete (rest as Record<string, unknown>).thumbnailUrl;
    delete (rest as Record<string, unknown>).thumbBreakpoint;

    const avifSrcSet  = buildSrcSet(variants, 'avif');
    const webpSrcSet  = buildSrcSet(variants, 'webp');
    const jpegSrcSet  = buildSrcSet(variants, 'jpeg');
    const sizes       = sizesProp ?? buildSizes(context);
    const fallbackSrc = getVariantUrl(variants, 'original', 'webp') ?? src;

    /* CSS-only LQIP blur-up:
     * - background-image: the tiny blurDataURL renders until real pixels arrive
     * - backgroundSize/Position: ensure the placeholder covers the element
     * - dominantColor is the fallback if no LQIP is available */
    const placeholderBg = blurDataURL
      ? `url("${blurDataURL}")`
      : dominantColor
      ? undefined
      : undefined;

    const style: CSSProperties = {
      ...(dominantColor ? { backgroundColor: dominantColor } : {}),
      ...(placeholderBg ? {
        backgroundImage:    placeholderBg,
        backgroundSize:     'cover',
        backgroundPosition: 'center',
      } : {}),
      ...(rest.style as CSSProperties | undefined),
    };

    /* LCP hint: eager + fetchpriority="high" */
    const fetchPriority = loading === 'eager' ? 'high' : 'auto';

    return (
      <picture>
        {avifSrcSet && (
          <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
        )}
        {webpSrcSet && (
          <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
        )}
        {jpegSrcSet && (
          <source type="image/jpeg" srcSet={jpegSrcSet} sizes={sizes} />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...rest}
          src={fallbackSrc}
          alt={alt}
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          style={style}
        />
      </picture>
    );
  }

  // ── Legacy mode (backward-compatible) ────────────────────────────────
  const { src, thumbnailUrl, thumbBreakpoint = 640, alt: _alt, ...rest } = props as LegacyProps;
  delete (rest as Record<string, unknown>).variants;
  delete (rest as Record<string, unknown>).blurDataURL;
  delete (rest as Record<string, unknown>).dominantColor;
  delete (rest as Record<string, unknown>).context;

  const hasSrcSet = !!thumbnailUrl && thumbnailUrl !== src;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      srcSet={hasSrcSet ? `${thumbnailUrl} 400w, ${src} 1200w` : undefined}
      sizes={hasSrcSet ? `(max-width: ${thumbBreakpoint}px) 400px, 1200px` : undefined}
      alt={alt}
      loading={loading}
      decoding={decoding}
      {...rest}
    />
  );
}
