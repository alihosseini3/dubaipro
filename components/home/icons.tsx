/**
 * Stroke-only SVG icons used across the homepage sections. Every icon
 * inherits its colour via `currentColor` so callers can theme via
 * Tailwind text utilities. Kept inline so the home renderer is
 * dependency-free at the component level (no lucide bundle on the
 * critical path).
 */

type IconProps = { className?: string };

function base(
  paths: React.ReactNode,
  className?: string,
  options?: { strokeWidth?: number }
) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={options?.strokeWidth ?? 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths}
    </svg>
  );
}

export function ShieldCheckIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>,
    className
  );
}

export function LockIcon({ className }: IconProps) {
  return base(
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </>,
    className
  );
}

export function TruckIcon({ className }: IconProps) {
  return base(
    <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    className
  );
}

export function TagIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M20 12 12 20l-9-9V3h8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>,
    className
  );
}

export function GlobeIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>,
    className
  );
}

export function BoltIcon({ className }: IconProps) {
  return base(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />, className);
}

export function CheckIcon({ className }: IconProps) {
  return base(<path d="m5 12 5 5 9-11" />, className, { strokeWidth: 2.5 });
}

export function ArrowRightIcon({ className }: IconProps) {
  return base(<path d="M5 12h14M13 5l7 7-7 7" />, className, {
    strokeWidth: 2.25
  });
}

export function MessageSquareIcon({ className }: IconProps) {
  return base(
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    className,
    { strokeWidth: 2 }
  );
}

export function StoreIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M3 7h18l-1 4H4z" />
      <path d="M5 11v9h14v-9" />
      <path d="M9 21v-6h6v6" />
    </>,
    className
  );
}

export function CartIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </>,
    className
  );
}

export function PackageIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>,
    className
  );
}

export function SparkleIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6 6 2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </>,
    className
  );
}

export function WarehouseIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M3 9l9-5 9 5v11H3z" />
      <path d="M7 20v-7h10v7M7 16h10" />
    </>,
    className
  );
}

export function BuildingIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M5 21V3h14v18M9 7h2M9 11h2M9 15h2M13 7h2M13 11h2M13 15h2M9 21v-3h6v3" />
    </>,
    className
  );
}

export function ClockIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    className
  );
}

export function HammerIcon({ className }: IconProps) {
  return base(
    <>
      <path d="m14 5 5 5-7 7-5-5z" />
      <path d="m9 13-6 6 2 2 6-6" />
      <path d="m14 5 3-3 5 5-3 3" />
    </>,
    className
  );
}

export function StarIcon({ className }: IconProps) {
  return base(
    <path d="M12 17.3l-6.16 3.7 1.64-7.03L2 9.24l7.19-.62L12 2l2.81 6.62 7.19.62-5.48 4.73 1.64 7.03z" />,
    className,
    { strokeWidth: 1.5 }
  );
}

export function VerifiedIcon({ className }: IconProps) {
  return base(
    <>
      <path d="m12 2 2.5 1.8L17.5 3l1 3 3 1-1 3 1 3-3 1-1 3-3-.8L12 22l-2.5-1.8L6.5 21l-1-3-3-1 1-3-1-3 3-1 1-3 3 .8z" />
      <path d="m9 12 2 2 4-4" />
    </>,
    className
  );
}
