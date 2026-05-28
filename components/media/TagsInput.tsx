'use client';

/**
 * TagsInput — pill-style tag input for media asset tagging.
 * Separate from SeoInputsPanel.keywords — used for folder/entity tags.
 */

import { useState, type KeyboardEvent } from 'react';

const MAX_TAGS = 30;

interface Props {
  value:       string[];
  onChange:    (tags: string[]) => void;
  placeholder?: string;
  className?:  string;
  disabled?:   boolean;
}

export function TagsInput({ value, onChange, placeholder = 'Add tag…', className, disabled }: Props) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const v = draft.trim().toLowerCase().replace(/\s+/g, '-');
    if (!v || value.includes(v) || value.length >= MAX_TAGS) { setDraft(''); return; }
    onChange([...value, v]);
    setDraft('');
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && draft === '' && value.length > 0) onChange(value.slice(0, -1));
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 transition focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className ?? ''}`}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
          {tag}
          <button type="button" onClick={() => remove(tag)} className="text-slate-400 transition hover:text-slate-900" aria-label={`Remove ${tag}`}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled}
        className="min-w-[100px] flex-1 border-0 bg-transparent text-xs text-slate-700 outline-none"
      />
      <span className="text-[10px] tabular-nums text-slate-400">{value.length}/{MAX_TAGS}</span>
    </div>
  );
}
