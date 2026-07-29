import { create } from 'zustand';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';
export type LeftPanelTab = 'layers' | 'insert';

/** Rendered canvas width per breakpoint (matches codegen media queries). */
export const BREAKPOINT_WIDTH: Record<Breakpoint, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

interface EditorUiState {
  breakpoint: Breakpoint;
  setBreakpoint: (bp: Breakpoint) => void;

  /**
   * Free-drag from the Insert palette (F11). Not dnd-kit — the canvas
   * owns pointer tracking + drop probes while this is set.
   */
  paletteDragKey: string | null;
  /** Cursor position while a free-drag is active (ghost + probes). */
  freeDragPoint: { x: number; y: number } | null;
  setPaletteDragKey: (key: string | null) => void;
  setFreeDragPoint: (point: { x: number; y: number } | null) => void;
  /**
   * Free-drag of an already-placed node from the canvas selection overlay.
   * Drop target is resolved via the same iframe drop-probe as palette inserts.
   */
  canvasMoveId: string | null;
  setCanvasMoveId: (id: string | null) => void;

  /** Whether the Site Styles (global tokens) panel is open. */
  siteStylesOpen: boolean;
  setSiteStylesOpen: (open: boolean) => void;

  /**
   * Left Layers/Insert dock. Collapse while customizing on the canvas;
   * expand when structuring or adding widgets.
   */
  leftPanelOpen: boolean;
  leftPanelTab: LeftPanelTab;
  setLeftPanelOpen: (open: boolean) => void;
  toggleLeftPanel: () => void;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  /** Open the left dock (optionally to a specific tab). */
  openLeftPanel: (tab?: LeftPanelTab) => void;
}

/** Editor-chrome UI state (breakpoint switcher, later: zoom, grid, etc.). */
export const useEditorUiStore = create<EditorUiState>((set, get) => ({
  breakpoint: 'desktop',
  setBreakpoint: (breakpoint) => set({ breakpoint }),

  paletteDragKey: null,
  freeDragPoint: null,
  setPaletteDragKey: (paletteDragKey) =>
    set({
      paletteDragKey,
      ...(paletteDragKey === null ? { freeDragPoint: null } : {}),
    }),
  setFreeDragPoint: (freeDragPoint) => set({ freeDragPoint }),
  canvasMoveId: null,
  setCanvasMoveId: (canvasMoveId) =>
    set({
      canvasMoveId,
      ...(canvasMoveId === null ? { freeDragPoint: null } : {}),
    }),

  siteStylesOpen: false,
  setSiteStylesOpen: (siteStylesOpen) => set({ siteStylesOpen }),

  leftPanelOpen: true,
  leftPanelTab: 'layers',
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  toggleLeftPanel: () => set({ leftPanelOpen: !get().leftPanelOpen }),
  setLeftPanelTab: (leftPanelTab) => set({ leftPanelTab }),
  openLeftPanel: (tab) =>
    set(tab ? { leftPanelOpen: true, leftPanelTab: tab } : { leftPanelOpen: true }),
}));
