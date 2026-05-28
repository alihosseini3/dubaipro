'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { folderLabel, PRESET_FOLDERS, type FolderInfo } from './types';

const Ic = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={d} />
  </svg>
);

type Props = {
  folder: string;
  folderList: FolderInfo[];
  total: number;
  showMobile?: boolean;
  onCloseMobile?(): void;
  onChangeFolder(name: string): void;
  onCreateFolder(name: string): Promise<void>;
  onDeleteFolder(name: string): Promise<void>;
  onRenameFolder(name: string, newName: string): Promise<void>;
};

export function FolderSidebar({
  folder, folderList, total,
  showMobile, onCloseMobile,
  onChangeFolder, onCreateFolder, onDeleteFolder, onRenameFolder,
}: Props) {
  const t = useTranslations('admin.gallery');
  const [showNew, setShowNew]     = useState(false);
  const [newName, setNewName]     = useState('');
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      await onCreateFolder(trimmed);
      setNewName('');
      setShowNew(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setCreating(false);
    }
  };

  const startRename = (name: string, currentLabel: string | null) => {
    setRenamingFolder(name);
    setRenameVal(currentLabel || name);
    setTimeout(() => renameRef.current?.select(), 30);
  };

  const handleRename = async () => {
    if (!renamingFolder || !renameVal.trim()) { setRenamingFolder(null); return; }
    await onRenameFolder(renamingFolder, renameVal.trim());
    setRenamingFolder(null);
  };

  const presetFolders = PRESET_FOLDERS.map((n) => folderList.find((f) => f.name === n)).filter(Boolean) as FolderInfo[];
  const catFolders    = folderList.filter((f) => f.name.startsWith('cat-'));
  const customFolders = folderList.filter((f) => f.custom && !PRESET_FOLDERS.includes(f.name) && !f.name.startsWith('cat-'));
  const otherFolders  = folderList.filter((f) => !f.custom && !PRESET_FOLDERS.includes(f.name) && !f.name.startsWith('cat-'));

  return (
    <>
      {/* Mobile backdrop */}
      {showMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

    <aside className={`shrink-0 flex-col border-e border-slate-200 bg-[#0F172A]
        ${showMobile
          ? 'fixed inset-y-0 start-0 z-50 flex w-[72vw] max-w-[260px] shadow-2xl transition-transform'
          : 'hidden lg:flex lg:w-56'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          {t('foldersTitle')}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={t('folderNew')}
            onClick={() => {
              setShowNew(true); setError(null); setNewName('');
              setTimeout(() => inputRef.current?.focus(), 40);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-orange-400"
          >
            <Ic d="M12 5v14M5 12h14" className="h-3.5 w-3.5" />
          </button>
          {showMobile && (
            <button type="button" onClick={onCloseMobile}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-white lg:hidden">
              <Ic d="M18 6L6 18M6 6l12 12" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Folder list */}
      <nav className="flex-1 overflow-y-auto py-1.5 scrollbar-thin">
        <FolderBtn
          name="all" label={t('folderAll')} count={total}
          active={folder === 'all'} onClick={() => onChangeFolder('all')}
        />

        {presetFolders.length > 0 && (
          <>
            <SectionLabel>{t('foldersPreset')}</SectionLabel>
            {presetFolders.map((f) => (
              <FolderBtn key={f.name} name={f.name} label={folderLabel(f.name, f.label)}
                count={f.count} active={folder === f.name} onClick={() => onChangeFolder(f.name)} />
            ))}
          </>
        )}

        {customFolders.length > 0 && (
          <>
            <SectionLabel>{t('foldersCustom')}</SectionLabel>
            {customFolders.map((f) =>
              renamingFolder === f.name ? (
                <div key={f.name} className="flex items-center gap-1 px-3 py-1">
                  <input ref={renameRef} value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleRename(); if (e.key === 'Escape') setRenamingFolder(null); }}
                    className="flex-1 rounded-md bg-slate-700 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500" />
                  <button type="button" onClick={handleRename}
                    className="rounded-md bg-orange-500 px-1.5 py-1 text-[10px] font-semibold text-white hover:bg-orange-600">
                    ✓
                  </button>
                </div>
              ) : (
                <FolderBtn key={f.name} name={f.name} label={folderLabel(f.name, f.label)}
                  count={f.count} active={folder === f.name} onClick={() => onChangeFolder(f.name)}
                  canDelete={f.count === 0} canRename
                  onDelete={() => onDeleteFolder(f.name)}
                  onRename={() => startRename(f.name, f.label)}
                />
              )
            )}
          </>
        )}

        {catFolders.length > 0 && (
          <>
            <SectionLabel>{t('foldersCategories')}</SectionLabel>
            {catFolders.map((f) => (
              <FolderBtn key={f.name} name={f.name} label={folderLabel(f.name, f.label)}
                count={f.count} active={folder === f.name} onClick={() => onChangeFolder(f.name)} />
            ))}
          </>
        )}

        {otherFolders.map((f) => (
          <FolderBtn key={f.name} name={f.name} label={folderLabel(f.name, f.label)}
            count={f.count} active={folder === f.name} onClick={() => onChangeFolder(f.name)} />
        ))}
      </nav>

      {/* New folder form */}
      {showNew && (
        <div className="border-t border-slate-700 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-slate-300">{t('folderNew')}</p>
          <input ref={inputRef} type="text" value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
              if (e.key === 'Escape') { setShowNew(false); setNewName(''); }
            }}
            placeholder={t('folderNamePlaceholder')}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50" />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex gap-1.5">
            <button type="button" onClick={handleCreate} disabled={!newName.trim() || creating}
              className="flex-1 rounded-lg bg-orange-500 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-40">
              {creating ? '…' : t('folderCreate')}
            </button>
            <button type="button" onClick={() => { setShowNew(false); setNewName(''); setError(null); }}
              className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-300">
              {t('folderCancel')}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-700 px-4 py-2.5 text-[11px] text-slate-500">
        {t('fileCount', { n: total })}
      </div>
    </aside>
    </>
  );
}

function FolderBtn({
  name, label, count, active, onClick, canDelete, canRename, onDelete, onRename,
}: {
  name: string; label: string; count: number; active: boolean; onClick(): void;
  canDelete?: boolean; canRename?: boolean; onDelete?(): void; onRename?(): void;
}) {
  return (
    <div className={`group flex items-center transition ${active ? 'bg-orange-500/15' : 'hover:bg-slate-800'}`}>
      <button type="button" onClick={onClick}
        className={`flex min-w-0 flex-1 items-center gap-2 px-4 py-1.5 text-sm transition ${
          active ? 'font-semibold text-orange-400' : 'text-slate-400 group-hover:text-slate-200'
        }`}>
        <Ic d={name === 'all'
          ? 'M3 3h18v14H3zM3 21l4-4h10l4 4'
          : 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z'}
          className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-orange-400' : 'text-slate-600'}`} />
        <span className="truncate">{label}</span>
        <span className={`ms-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          active ? 'bg-orange-500/20 text-orange-300' : 'bg-slate-700 text-slate-500'
        }`}>{count}</span>
      </button>
      {(canRename || canDelete) && (
        <div className="me-2 hidden items-center gap-0.5 group-hover:flex">
          {canRename && onRename && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onRename(); }}
              className="rounded p-0.5 text-slate-500 hover:text-slate-300">
              <Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" className="h-3 w-3" />
            </button>
          )}
          {canDelete && onDelete && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded p-0.5 text-slate-500 hover:text-red-400">
              <Ic d="M18 6L6 18M6 6l12 12" className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
      {children}
    </p>
  );
}
