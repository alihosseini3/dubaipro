type Props = {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
};

const SIZE_MAP = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5'
} as const;

export function Stars({ value, size = 'md', className = '', ariaLabel }: Props) {
  // Clamp 0–5 and round to nearest half to support half-star display.
  const clamped = Math.max(0, Math.min(5, value));
  const rounded = Math.round(clamped * 2) / 2;
  const cls = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={ariaLabel ?? `${rounded} of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = rounded >= i;
        const half = !filled && rounded >= i - 0.5;
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={cls}
            aria-hidden
          >
            <defs>
              <linearGradient id={`star-half-${i}`}>
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            <path
              d="M12 17.3l-6.16 3.7 1.64-7.03L2 9.24l7.19-.62L12 2l2.81 6.62 7.19.62-5.48 4.73 1.64 7.03z"
              fill={
                filled ? '#f59e0b' : half ? `url(#star-half-${i})` : '#e2e8f0'
              }
              stroke="#f59e0b"
              strokeWidth={filled || half ? 0 : 1}
            />
          </svg>
        );
      })}
    </span>
  );
}
