'use client';

import { useMemo, useState } from 'react';

type Point = { date: string; value: number };

type Props = {
  data: Point[];
  ariaLabel?: string;
};

/**
 * Vertical bar chart with hover highlighting. Paired with `LineChart` in the
 * dashboard: the bar treatment emphasises discrete daily counts (orders),
 * while the line + area fill reads as a continuous monetary flow.
 */
export function BarChart({ data, ariaLabel }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 720;
  const H = 220;
  const PAD_X = 8;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 28;

  const { bars, yMax, gridLines } = useMemo(() => {
    if (data.length === 0) {
      return { bars: [], yMax: 0, gridLines: [] as number[] };
    }
    const max = Math.max(...data.map((d) => d.value), 1);
    const yTop = niceCeil(max);
    const innerW = W - PAD_X * 2;
    const innerH = H - PAD_TOP - PAD_BOTTOM;
    const slotW = innerW / data.length;
    const barW = Math.max(2, Math.min(slotW * 0.62, 28));
    const bs = data.map((p, i) => {
      const h = (p.value / yTop) * innerH;
      return {
        x: PAD_X + i * slotW + slotW / 2 - barW / 2,
        y: PAD_TOP + innerH - h,
        w: barW,
        h,
        p
      };
    });
    return {
      bars: bs,
      yMax: yTop,
      gridLines: [0, 0.25, 0.5, 0.75, 1].map(
        (f) => PAD_TOP + innerH - f * innerH
      )
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
        style={{ height: H }}
      >
        —
      </div>
    );
  }

  const firstDate = data[0]?.date ?? '';
  const lastDate = data[data.length - 1]?.date ?? '';
  const hover = hoverIdx !== null ? bars[hoverIdx] : null;

  return (
    <div className="relative w-full">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full"
        onMouseLeave={() => setHoverIdx(null)}
      >
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

        {bars.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={3}
              fill={hoverIdx === i ? '#0284c7' : '#38bdf8'}
              className="transition-colors duration-150"
            />
            {/* Wider hit zone so hover is forgiving on slim bars. */}
            <rect
              x={b.x - Math.max((W - PAD_X * 2) / bars.length / 2 - b.w / 2, 0)}
              y={0}
              width={(W - PAD_X * 2) / bars.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          </g>
        ))}

        <text x={PAD_X} y={H - 8} fontSize={10} fill="#94a3b8">
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
        <text x={PAD_X} y={PAD_TOP - 4} fontSize={10} fill="#94a3b8">
          {yMax}
        </text>
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{
            left: `${((hover.x + hover.w / 2) / W) * 100}%`,
            top: `${(hover.y / H) * 100 - 8}%`
          }}
        >
          <div className="tabular-nums">{hover.p.value.toLocaleString()}</div>
          <div className="text-[10px] font-normal text-slate-300">
            {hover.p.date}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
