'use client';

import { useMemo, useState } from 'react';

export type PickerCategory = { id: string; name: string; parentId: string | null };

type Props = {
  categories: PickerCategory[];
  /** Selected ids. The first id is treated as the primary category. */
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

/**
 * Mobile-friendly accordion category picker shared by the registration
 * wizard and the supplier profile editor. Main categories expand to reveal
 * their subcategories; any combination can be ticked.
 */
export function CategoryTreePicker({ categories, value, onChange, disabled }: Props) {
  const tree = useMemo(() => {
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    const roots = sorted.filter((c) => !c.parentId);
    const byParent = new Map<string, PickerCategory[]>();
    for (const c of sorted) {
      if (c.parentId) {
        const arr = byParent.get(c.parentId) ?? [];
        arr.push(c);
        byParent.set(c.parentId, arr);
      }
    }
    return roots.map((root) => ({ ...root, children: byParent.get(root.id) ?? [] }));
  }, [categories]);

  function toggle(id: string) {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  return (
    <div className="rounded-xl border border-slate-200">
      {tree.map((root, i) => (
        <Row
          key={root.id}
          root={root}
          isLast={i === tree.length - 1}
          selected={value}
          onToggle={toggle}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function Row({
  root,
  isLast,
  selected,
  onToggle,
  disabled,
}: {
  root: PickerCategory & { children: PickerCategory[] };
  isLast: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  const hasChildren = root.children.length > 0;
  const selectedChildren = root.children.filter((c) => selected.includes(c.id)).length;
  const [open, setOpen] = useState(selectedChildren > 0);

  return (
    <div className={isLast ? '' : 'border-b border-slate-100'}>
      <div className="flex items-center gap-2 px-2 sm:px-3">
        <label className="flex flex-1 cursor-pointer items-center gap-3 py-3.5">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            checked={selected.includes(root.id)}
            onChange={() => onToggle(root.id)}
            disabled={disabled}
          />
          <span className="text-sm font-semibold text-slate-800">{root.name}</span>
          {selectedChildren > 0 && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
              {selectedChildren}
            </span>
          )}
        </label>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && open && (
        <div className="bg-slate-50/60 pb-1">
          {root.children.map((child) => (
            <label key={child.id} className="flex cursor-pointer items-center gap-3 py-3 pl-11 pr-3">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                checked={selected.includes(child.id)}
                onChange={() => onToggle(child.id)}
                disabled={disabled}
              />
              <span className="text-sm text-slate-700">{child.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
