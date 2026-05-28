'use client';

import { useState } from 'react';

type Props = {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  size?: 'md' | 'lg';
};

const SIZE_MAP = {
  md: 'h-6 w-6',
  lg: 'h-8 w-8'
} as const;

export function StarRatingInput({
  value,
  onChange,
  disabled = false,
  size = 'lg'
}: Props) {
  const [hover, setHover] = useState<number>(0);
  const effective = hover || value;
  const cls = SIZE_MAP[size];

  return (
    <div
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHover(0)}
      role="radiogroup"
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const active = i <= effective;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i}`}
            disabled={disabled}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            className={`transition ${
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            }`}
          >
            <svg viewBox="0 0 24 24" className={cls} aria-hidden>
              <path
                d="M12 17.3l-6.16 3.7 1.64-7.03L2 9.24l7.19-.62L12 2l2.81 6.62 7.19.62-5.48 4.73 1.64 7.03z"
                fill={active ? '#f59e0b' : '#e2e8f0'}
                stroke="#f59e0b"
                strokeWidth={active ? 0 : 1}
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
