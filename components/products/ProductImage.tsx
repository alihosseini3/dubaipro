type ProductImageProps = {
  title: string;
  src?: string | null;
  /** Tailwind aspect ratio utility (e.g. 'aspect-square', 'aspect-[4/3]'). */
  aspect?: string;
  /** Extra classes for the wrapper (e.g. border radius). */
  className?: string;
  /** Add a zoom-on-hover effect for cards and galleries. */
  zoomOnHover?: boolean;
  /** Controls eager/lazy loading for priority images. */
  priority?: boolean;
};

/**
 * Renders a product image with a deterministic gradient placeholder fallback.
 *
 * - When `src` is present, shows the image with optional hover zoom + fade-in.
 * - Otherwise, renders a gradient derived from the product title so each
 *   product still has a unique, stable visual identity.
 */
export function ProductImage({
  title,
  src,
  aspect = 'aspect-[4/3]',
  className = '',
  zoomOnHover = false,
  priority = false
}: ProductImageProps) {
  const hue = Array.from(title).reduce(
    (acc, ch) => (acc + ch.charCodeAt(0)) % 360,
    0
  );
  const background = `linear-gradient(135deg, hsl(${hue} 70% 80%), hsl(${(hue + 40) % 360} 70% 60%))`;

  if (src) {
    return (
      <div className={`relative overflow-hidden ${aspect} w-full bg-slate-100 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={title}
          loading={priority ? 'eager' : 'lazy'}
          className={
            'h-full w-full animate-fadeIn object-cover transition-transform duration-500 ease-out ' +
            (zoomOnHover ? 'group-hover:scale-105' : '')
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex ${aspect} w-full items-center justify-center overflow-hidden ${className}`}
      style={{ background }}
      aria-hidden
    >
      <svg
        viewBox="0 0 64 64"
        className={
          'h-12 w-12 text-white/80 transition-transform duration-500 ease-out ' +
          (zoomOnHover ? 'group-hover:scale-110' : '')
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="8" y="12" width="48" height="40" rx="4" />
        <path d="M8 44l12-12 10 10 8-8 18 18" />
        <circle cx="22" cy="24" r="3" />
      </svg>
    </div>
  );
}
