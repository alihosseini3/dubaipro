import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
};

type AdminTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
};

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  emptyLabel = 'No data yet',
  emptyDescription,
  emptyAction,
}: AdminTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0H4m8-4v4m0 0-2-2m2 2 2-2" />
          </svg>
        </div>
        <div>
          <p className="text-[14px] font-semibold text-slate-700">{emptyLabel}</p>
          {emptyDescription && (
            <p className="mt-1 text-[13px] text-slate-400">{emptyDescription}</p>
          )}
        </div>
        {emptyAction && <div className="mt-1">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    'px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.className ?? '',
                  ].join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={[
                  'border-b border-slate-50 transition-colors last:border-0 hover:bg-orange-500/[0.03]',
                  i % 2 === 1 ? 'bg-slate-50/30' : 'bg-white',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-5 py-3.5 align-middle text-slate-700',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '',
                      col.className ?? '',
                    ].join(' ')}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
