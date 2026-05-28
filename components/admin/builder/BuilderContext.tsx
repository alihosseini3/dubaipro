'use client';

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import type { PageDTO, PageSectionDTO, PageSeoDTO, SectionConfig } from '@/lib/pages/service';
import type { PageSectionType } from '@/lib/pages/types';

/* ─── Viewport ──────────────────────────────────────────────────────────── */

export type Viewport = 'desktop' | 'tablet' | 'mobile';

export const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: '100%',
  tablet:  '768px',
  mobile:  '390px',
};

/* ─── State ─────────────────────────────────────────────────────────────── */

export type ToastType = 'success' | 'error' | 'info';

export type Toast = { id: number; message: string; type: ToastType };

export type BuilderState = {
  page:         PageDTO;
  sections:     PageSectionDTO[];
  seo:          PageSeoDTO | null;
  selectedId:   string | null;
  viewport:     Viewport;
  leftOpen:     boolean;
  rightOpen:    boolean;
  dirty:        boolean;
  saving:       boolean;
  toasts:       Toast[];
};

/* ─── Actions ───────────────────────────────────────────────────────────── */

type Action =
  | { type: 'SET_SECTIONS';    sections: PageSectionDTO[] }
  | { type: 'ADD_SECTION';     section:  PageSectionDTO }
  | { type: 'UPDATE_SECTION';  id: string; config: SectionConfig }
  | { type: 'DELETE_SECTION';  id: string }
  | { type: 'TOGGLE_VISIBLE';  id: string }
  | { type: 'DUPLICATE';       id: string }
  | { type: 'SELECT';          id: string | null }
  | { type: 'SET_VIEWPORT';    viewport: Viewport }
  | { type: 'SET_DIRTY';       dirty: boolean }
  | { type: 'SET_SAVING';      saving: boolean }
  | { type: 'TOGGLE_LEFT' }
  | { type: 'TOGGLE_RIGHT' }
  | { type: 'SET_SEO';         seo: PageSeoDTO }
  | { type: 'UPDATE_PAGE';     patch: Partial<PageDTO> }
  | { type: 'PUSH_TOAST';      toast: Toast }
  | { type: 'POP_TOAST';       id: number };

function reducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {
    case 'SET_SECTIONS':
      return { ...state, sections: action.sections, dirty: true };
    case 'ADD_SECTION':
      return { ...state, sections: [...state.sections, action.section], selectedId: action.section.id, dirty: true };
    case 'UPDATE_SECTION':
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, config: action.config } : s
        ),
        dirty: true,
      };
    case 'DELETE_SECTION':
      return {
        ...state,
        sections: state.sections.filter((s) => s.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        dirty: true,
      };
    case 'TOGGLE_VISIBLE':
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, isVisible: !s.isVisible } : s
        ),
        dirty: true,
      };
    case 'DUPLICATE': {
      const src = state.sections.find((s) => s.id === action.id);
      if (!src) return state;
      const clone: PageSectionDTO = {
        ...src,
        id: `tmp-${Date.now()}`,
        order: src.order + 0.5,
      };
      const next = [...state.sections, clone].sort((a, b) => a.order - b.order);
      return { ...state, sections: next, selectedId: clone.id, dirty: true };
    }
    case 'SELECT':
      return { ...state, selectedId: action.id };
    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };
    case 'SET_DIRTY':
      return { ...state, dirty: action.dirty };
    case 'SET_SAVING':
      return { ...state, saving: action.saving };
    case 'TOGGLE_LEFT':
      return { ...state, leftOpen: !state.leftOpen };
    case 'TOGGLE_RIGHT':
      return { ...state, rightOpen: !state.rightOpen };
    case 'SET_SEO':
      return { ...state, seo: action.seo };
    case 'UPDATE_PAGE':
      return { ...state, page: { ...state.page, ...action.patch }, dirty: true };
    case 'PUSH_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] };
    case 'POP_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

/* ─── Context ───────────────────────────────────────────────────────────── */

type Ctx = {
  state:          BuilderState;
  dispatch:       React.Dispatch<Action>;
  canUndo:        boolean;
  canRedo:        boolean;
  undo:           () => void;
  redo:           () => void;
  toast:          (message: string, type?: ToastType) => void;
  addSection:     (type: PageSectionType) => Promise<void>;
  saveSection:    (id: string, config: SectionConfig) => Promise<void>;
  deleteSection:  (id: string) => Promise<void>;
  reorder:        (ids: string[]) => Promise<void>;
  savePage:       () => Promise<void>;
  saveSeo:        (seo: Partial<PageSeoDTO>) => Promise<void>;
};

const BuilderCtx = createContext<Ctx | null>(null);

export function useBuilder() {
  const ctx = useContext(BuilderCtx);
  if (!ctx) throw new Error('useBuilder must be inside BuilderProvider');
  return ctx;
}

/* ─── History ───────────────────────────────────────────────────────────── */

const MAX_HISTORY = 50;

/* ─── Provider ──────────────────────────────────────────────────────────── */

export function BuilderProvider({
  initial,
  locale,
  children,
}: {
  initial: PageDTO;
  locale:  string;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    page:       initial,
    sections:   initial.sections,
    seo:        initial.seo,
    selectedId: null,
    viewport:   'desktop',
    leftOpen:   true,
    rightOpen:  true,
    dirty:      false,
    saving:     false,
    toasts:     [],
  });

  const toastIdRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastIdRef.current;
    dispatch({ type: 'PUSH_TOAST', toast: { id, message, type } });
    setTimeout(() => dispatch({ type: 'POP_TOAST', id }), 3500);
  }, []);

  const historyRef = useRef<PageSectionDTO[][]>([initial.sections]);
  const histPtrRef = useRef(0);

  const pushHistory = useCallback((sections: PageSectionDTO[]) => {
    const sliced = historyRef.current.slice(0, histPtrRef.current + 1);
    sliced.push(sections);
    if (sliced.length > MAX_HISTORY) sliced.shift();
    historyRef.current = sliced;
    histPtrRef.current = sliced.length - 1;
  }, []);

  const canUndo = histPtrRef.current > 0;
  const canRedo = histPtrRef.current < historyRef.current.length - 1;

  const undo = useCallback(() => {
    if (!canUndo) return;
    histPtrRef.current -= 1;
    dispatch({ type: 'SET_SECTIONS', sections: historyRef.current[histPtrRef.current] });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    histPtrRef.current += 1;
    dispatch({ type: 'SET_SECTIONS', sections: historyRef.current[histPtrRef.current] });
  }, [canRedo]);

  /* ── API helpers ── */

  const addSection = useCallback(async (type: PageSectionType) => {
    const res = await fetch(`/api/admin/pages/${initial.id}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, config: {}, isVisible: true }),
    });
    if (!res.ok) { toast('Failed to add section', 'error'); return; }
    const json = await res.json();
    dispatch({ type: 'ADD_SECTION', section: json.data as PageSectionDTO });
    pushHistory([...state.sections, json.data as PageSectionDTO]);
    toast(`${type.replace(/_/g, ' ')} added`);
  }, [initial.id, state.sections, pushHistory, toast]);

  const saveSection = useCallback(async (id: string, config: SectionConfig) => {
    dispatch({ type: 'UPDATE_SECTION', id, config });
    await fetch(`/api/admin/pages/${initial.id}/sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    }).catch(() => {});
  }, [initial.id]);

  const deleteSection = useCallback(async (id: string) => {
    dispatch({ type: 'DELETE_SECTION', id });
    await fetch(`/api/admin/pages/${initial.id}/sections/${id}`, {
      method: 'DELETE',
    }).catch(() => {});
  }, [initial.id]);

  const reorder = useCallback(async (ids: string[]) => {
    await fetch(`/api/admin/pages/${initial.id}/sections/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  }, [initial.id]);

  const savePage = useCallback(async () => {
    dispatch({ type: 'SET_SAVING', saving: true });
    try {
      const { page } = state;
      const res = await fetch(`/api/admin/pages/${initial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: page.title,
          slug: page.slug,
          metaTitle: page.metaTitle,
          metaDescription: page.metaDescription,
          status: page.status,
          locale: page.locale,
        }),
      });
      if (res.ok) {
        dispatch({ type: 'SET_DIRTY', dirty: false });
        toast('Page saved successfully');
      } else {
        toast('Save failed', 'error');
      }
    } catch {
      toast('Save failed', 'error');
    } finally {
      dispatch({ type: 'SET_SAVING', saving: false });
    }
  }, [state, initial.id, toast]);

  const saveSeo = useCallback(async (seo: Partial<PageSeoDTO>) => {
    const res = await fetch(`/api/admin/pages/${initial.id}/seo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(seo),
    });
    if (res.ok) {
      const json = await res.json();
      dispatch({ type: 'SET_SEO', seo: json.data });
      toast('SEO saved');
    } else {
      toast('SEO save failed', 'error');
    }
  }, [initial.id, toast]);

  return (
    <BuilderCtx.Provider value={{
      state, dispatch, canUndo, canRedo, undo, redo, toast,
      addSection, saveSection, deleteSection, reorder, savePage, saveSeo,
    }}>
      {children}
    </BuilderCtx.Provider>
  );
}
