'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { ERROR } from '../fields';

export type WizardCategory = { id: string; name: string; parentId: string | null };

type Props = {
  categories: WizardCategory[];
  selected: string[];
  onToggle: (id: string) => void;
  errors: Record<string, string>;
};

export function CategoriesStep({ categories, selected, onToggle, errors }: Props) {
  const t = useTranslations('supplierRegister');

  // parent → children tree for the accordion picker
  const tree = useMemo(() => {
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    const childrenByParent = new Map<string, WizardCategory[]>();
    for (const c of sorted) {
      if (c.parentId) {
        const arr = childrenByParent.get(c.parentId) ?? [];
        arr.push(c);
        childrenByParent.set(c.parentId, arr);
      }
    }
    return sorted
      .filter((c) => !c.parentId)
      .map((root) => ({ ...root, children: childrenByParent.get(root.id) ?? [] }));
  }, [categories]);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t('categoriesHint')}
      </p>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700">
        {tree.map((root, i) => (
          <CategoryTreeRow
            key={root.id}
            root={root}
            isLast={i === tree.length - 1}
            selected={selected}
            onToggle={onToggle}
          />
        ))}
      </div>

      {selected.length > 0 && (
        <p className="text-xs font-medium text-slate-500">
          {t('categoriesSelected', { count: selected.length })}
        </p>
      )}
      {errors.categories && <p className={ERROR}>{errors.categories}</p>}
    </div>
  );
}

function CategoryTreeRow({
  root,
  isLast,
  selected,
  onToggle
}: {
  root: WizardCategory & { children: WizardCategory[] };
  isLast: boolean;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const hasChildren = root.children.length > 0;
  const selectedChildren = root.children.filter((c) => selected.includes(c.id)).length;
  const [open, setOpen] = useState(selectedChildren > 0);

  const checkbox =
    'h-5 w-5 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-500';

  return (
    <div className={isLast ? '' : 'border-b border-slate-100 dark:border-slate-700'}>
      <div className="flex items-center gap-2 px-2 sm:px-3">
        <label className="flex flex-1 cursor-pointer items-center gap-3 py-3.5">
          <input
            type="checkbox"
            className={checkbox}
            checked={selected.includes(root.id)}
            onChange={() => onToggle(root.id)}
          />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {root.name}
          </span>
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-700"
            aria-expanded={open}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            >
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="bg-slate-50/60 pb-1 dark:bg-slate-900/30">
          {root.children.map((child) => (
            <label
              key={child.id}
              className="flex cursor-pointer items-center gap-3 py-3 pe-3 ps-11"
            >
              <input
                type="checkbox"
                className={checkbox}
                checked={selected.includes(child.id)}
                onChange={() => onToggle(child.id)}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {child.name}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
