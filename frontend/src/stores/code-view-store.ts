import { create } from 'zustand';

export type CodeLang = 'html' | 'css';

/**
 * Code View state (F13/F14). The Code View replaces the canvas in the
 * center pane when `open`, showing the page's generated HTML/CSS in Monaco.
 *
 * Read-only (F13): `value` shown is the live generated output; the panel
 * re-derives it from the tree on every edit (debounced).
 *
 * Editable (F14): when `editable`, the user's keystrokes go into
 * `draftHtml`/`draftCss` (a null draft means "still mirroring generated").
 * We intentionally STOP live-syncing generated output into the editor while
 * a draft exists, so canvas-driven tree changes don't clobber in-progress
 * hand edits — same freeze the canvas uses during inline text edits. On
 * apply/cancel the drafts reset to null and live mirroring resumes.
 */
interface CodeViewState {
  open: boolean;
  lang: CodeLang;
  editable: boolean;
  draftHtml: string | null;
  draftCss: string | null;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setLang: (lang: CodeLang) => void;
  setEditable: (editable: boolean) => void;
  /** Record an in-progress hand edit for one language. */
  setDraft: (lang: CodeLang, value: string) => void;
  /** Clear both drafts → resume live mirroring from the tree. */
  resetDrafts: () => void;
}

/** Leaving the Code View (or edit mode) always drops uncommitted drafts. */
function closedState(open: boolean) {
  return open
    ? { open: true as const }
    : { open: false as const, editable: false, draftHtml: null, draftCss: null };
}

export const useCodeViewStore = create<CodeViewState>((set, get) => ({
  open: false,
  lang: 'html',
  editable: false,
  draftHtml: null,
  draftCss: null,

  setOpen: (open) => set(closedState(open)),
  toggleOpen: () => set(closedState(!get().open)),
  setLang: (lang) => set({ lang }),

  setEditable: (editable) => {
    // Leaving edit mode always discards uncommitted drafts.
    if (!editable) set({ editable, draftHtml: null, draftCss: null });
    else set({ editable });
  },

  setDraft: (lang, value) =>
    set(lang === 'html' ? { draftHtml: value } : { draftCss: value }),

  resetDrafts: () => set({ draftHtml: null, draftCss: null }),
}));
