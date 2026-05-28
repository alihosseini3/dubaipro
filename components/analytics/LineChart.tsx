'use client';

import { useId, useMemo, useState } from 'react';

import { formatDisplayFromAED } from '@/lib/currency/service';
import type { DisplayCurrency } from '@/types/currency';

type Point = { date: string; value: number };

type Props = {
  data: Point[];
  /** When true, values are treated as AED monetary amounts and converted. */
  monetary?: boolean;
  display?: DisplayCurrency;
  ariaLabel?: string;
};

/**
 * Minimal, dependency-free SVG line chart with a soft area fill, faint grid,
 * and interactive hover crosshair. Sized via `viewBox` so it scales fluidly
 * to any container width.
 *
 * Design intent: feel at home next to Stripe/Shopify dashboards — subtle
 * gradient fill, thin stroke, no axis clutter, gentle hover tooltip.
 */
export function LineChart({
  data,
  monetary = false,
  display,
  ariaLabel
}: Props) {
  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 720;
  const H = 220;
  const PAD_X = 8;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 28;

  const { pathD, areaD, points, yMax, gridLines } = useMemo(() => {
    if (data.length === 0) {
      return {
        pathD: '',
        areaD: '',
        points: [] as Array<{ x: number; y: number; p: Point }>,
        yMax: 0,
        gridLines: [] as number[]
      };
    }
    const max = Math.max(...data.map((d) => d.value), 1);
    // Round up the y-axis to a pleasant top value.
    const yTop = niceCeil(max);
    const innerW = W - PAD_X * 2;
    const innerH = H - PAD_TOP - PAD_BOTTOM;
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((p, i) => ({
      x: PAD_X + i * stepX,
      y: PAD_TOP + innerH - (p.value / yTop) * innerH,
      p
    }));
    const line = pts
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');
    const area =
      line +
      ` L${pts[pts.length - 1].x.toFixed(1)},${(PAD_TOP + innerH).toFixed(1)}` +
      ` L${pts[0].x.toFixed(1)},${(PAD_TOP + innerH).toFixed(1)} Z`;
    return {
      pathD: line,
      areaD: area,
      points: pts,
      yMax: yTop,
      gridLines: [0, 0.25, 0.5, 0.75, 1].map(
        (f) => PAD_TOP + innerH - f * innerH
      )
    };
  }, [data]);

  if (data.length === 0) {
    return <EmptyChart H={H} />;
  }

  const fmt = (v: number) =>
    monetary && display
      ? formatDisplayFromAED(v, display)
      : v.toLocaleString();

  const firstDate = data[0]?.date ?? '';
  const lastDate = data[data.length - 1]?.date ?? '';
  const hover = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="relative w-full">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Faint horizontal grid */}
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={y}
            y2={y}
            stroke="#f1f5f9"
            strokeWidth={1}
          />
        ))}

        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Stroke */}
        <path
          d={pathD}
          fill="none"
          stroke="#059669"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover hit-zones (invisible, span vertical column per point) */}
        {points.map((pt, i) => (
          <rect
            key={i}
            x={pt.x - (W - PAD_X * 2) / Math.max(points.length - 1, 1) / 2}
            y={0}
            width={(W - PAD_X * 2) / Math.max(points.length - 1, 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}

        {/* Crosshair + dot */}
        {hover ? (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD_TOP}
              y2={H - PAD_BOTTOM}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r={4.5}
              fill="#fff"
              stroke="#059669"
              strokeWidth={2}
            />
          </>
        ) : null}

        {/* X-axis labels (endpoints only — keeps it clean) */}
        <text
          x={PAD_X}
          y={H - 8}
          fontSize={10}
          fill="#94a3b8"
          textAnchor="start"
        >
          {firstDate}
        </text>
        <text
          x={W - PAD_X}
          y={H - 8}
          fontSize={10}
          fill="#94a3b8"
          textAnchor="end"
        >
          {lastDate}
        </text>

        {/* Y max label (top-left) */}
        <text
          x={PAD_X}
          y={PAD_TOP - 4}
          fontSize={10}
          fill="#94a3b8"
          textAnchor="start"
        >
          {fmt(yMax)}
        </text>
      </svg>

      {/* Tooltip */}
      {hover ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100 - 8}%`
          }}
        >
          <div className="tabular-nums">{fmt(hover.p.value)}</div>
          <div className="text-[10px] font-normal text-slate-300">
            {hover.p.date}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyChart({ H }: { H: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
      style={{ height: H }}
    >
      —
    </div>
  );
}

/**
 * Round `n` up to a visually "nice" number: 1, 2, 2.5, 5, 10 × 10^k.
 * Makes the y-axis hero value readable (e.g. 4,723 → 5,000 not 4,723).
 */
function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const frac = n / base;
  let nice: number;
  if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 2.5) nice = 2.5;
  else if (frac <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}
