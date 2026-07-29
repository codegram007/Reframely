import { create } from 'zustand';
import type { Breakpoint, ColorToken, NodeStyles, TreeNode, TypographyToken, WidgetTree } from '@/lib/schema';
import { sampleTree } from '@/lib/sample-tree';
import { setNodeContent, setNodeProps, setNodeVisibility } from '@/lib/tree-edit';
import { setNodeStyle } from '@/lib/style-engine';
import { moveNode, insertNode } from '@/lib/tree-move';
import { reorderChildAtBreakpoint } from '@/lib/tree-reorder-bp';
import {
  addColorToken,
  removeColorToken,
  setColorTokenName,
  setColorTokenValue,
  setTypographyToken,
} from '@/lib/token-engine';
import { findNode } from '@/lib/tree-index';

type StyleKey = keyof NodeStyles;
type StyleInput = NodeStyles[StyleKey];

/**
 * Holds the current page's widget tree — the single source of truth the
 * canvas renders and the panels read — plus a unified undo/redo stack
 * (F15).
 *
 * History model: each entry is a full pre-mutation `WidgetTree` snapshot
 * (the inverse of the forward change). Every mutation path — style/content
 * panels, drag/drop, palette insert, code-view apply, token edits, and
 * future AI patches via `commit` — pushes exactly one undo-able entry.
 * Live previews (`preview*`) intentionally skip history so a slider drag
 * or keystroke stream becomes one step on commit.
 *
 * Durable versions (B8/B9) are separate: `useVersionAutosave` persists
 * checkpoints after commits; they are not the in-session undo stack.
 *
 * Edit sessions: inline text editing streams many keystrokes, but the
 * user expects ONE undo step per edit. So `beginEditSession` snapshots
 * the pre-edit tree, `previewContent` updates the live tree WITHOUT
 * touching history (so the canvas/panels reflect typing), and
 * `commitEditSession` pushes exactly one history entry for the whole
 * session (or discards it if nothing actually changed).
 */
interface TreeState {
  tree: WidgetTree;
  past: WidgetTree[];
  future: WidgetTree[];

  /** Snapshot before an edit session begins (null when not editing). */
  editBaseline: WidgetTree | null;

  setTree: (tree: WidgetTree) => void;

  /**
   * Apply a one-shot immutable change as a single undo step. The mutator
   * returns a new tree (or the same reference for a no-op, which adds no
   * history). Used for discrete edits like visibility toggles.
   */
  commit: (mutate: (tree: WidgetTree) => WidgetTree) => void;
  /** Toggle a node's visibility as one history step. */
  toggleVisibility: (id: string, visible: boolean) => void;

  /** Merge a props patch into a widget as one undo step. */
  setProps: (id: string, patch: Record<string, unknown>) => void;
  /** Live props preview during a session (e.g. cropper drag); no history. */
  previewProps: (id: string, patch: Record<string, unknown>) => void;

  /**
   * Move a node to a new parent + position as one undo step. Mirrors the
   * AI assistant's `move_node` op, so drag-and-drop and AI edits share a
   * single mutation path. No-op if the move is invalid.
   */
  moveNode: (nodeId: string, newParentId: string, position: number) => void;

  /**
   * Insert a fresh node (from the widget palette) into `parentId` at
   * `position` as one undo step. No-op if the parent can't hold the type.
   */
  insertNode: (node: TreeNode, parentId: string, position: number) => void;

  /**
   * Reorder a child within its parent at a non-desktop breakpoint by
   * writing CSS `order` overrides (one undo step). Structural order is
   * untouched, so desktop is unaffected — this is the PRD's mobile
   * restacking case. No-op on desktop or invalid indices.
   */
  reorderAtBreakpoint: (
    parentId: string,
    from: number,
    to: number,
    bp: Breakpoint,
  ) => void;

  // ---- Global design tokens (F12) ----------------------------------------
  // Value edits propagate to every referencing widget for free (codegen
  // emits token refs as CSS vars). Each of these is one undo step and
  // mirrors the assistant's `set_global_token` mutation shape. The color
  // *value* setter also has a preview variant for smooth picker dragging,
  // committed as a single step via {begin,commit}StyleSession.
  /** Set a color token's value; propagates site-wide. One undo step. */
  setColorTokenValue: (tokenId: string, value: string) => void;
  /** Live color-value preview during a picker drag; no history. */
  previewColorTokenValue: (tokenId: string, value: string) => void;
  /** Rename a color token's display name. One undo step. */
  setColorTokenName: (tokenId: string, name: string) => void;
  /** Patch a typography token's fields. One undo step. */
  setTypographyToken: (tokenId: string, patch: Partial<Omit<TypographyToken, 'id'>>) => void;
  /** Append a new color token. One undo step. */
  addColorToken: (token: ColorToken) => void;
  /** Remove a color token, inlining its value into referencing nodes. */
  removeColorToken: (tokenId: string) => void;

  /**
   * Set one style property at a breakpoint as a single undo step
   * (undefined clears the override → reverts to inherited). For discrete
   * changes: dropdowns, color pick, number blur.
   */
  setStyle: (id: string, bp: Breakpoint, key: StyleKey, value: StyleInput | undefined) => void;
  /** Begin a live style session (e.g. slider drag) — one undo on commit. */
  beginStyleSession: () => void;
  /** Live style update during a session; no history. */
  previewStyle: (id: string, bp: Breakpoint, key: StyleKey, value: StyleInput | undefined) => void;
  /** Finish the session: one undo step for the whole drag. */
  commitStyleSession: () => void;

  beginEditSession: () => void;
  /** Live-update content during typing; does not create history. */
  previewContent: (id: string, text: string) => void;
  /** Finish the session: one undo step for the whole edit. */
  commitEditSession: (id: string, text: string) => void;
  /** Abandon the session, reverting to the pre-edit baseline. */
  cancelEditSession: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const HISTORY_LIMIT = 100;

export const useTreeStore = create<TreeState>((set, get) => ({
  tree: sampleTree,
  past: [],
  future: [],
  editBaseline: null,

  setTree: (tree) => set({ tree, past: [], future: [], editBaseline: null }),

  commit: (mutate) => {
    const { tree, past } = get();
    const next = mutate(tree);
    if (next === tree) return; // no-op → no history
    set({
      tree: next,
      past: [...past, tree].slice(-HISTORY_LIMIT),
      future: [],
      editBaseline: null,
    });
  },

  toggleVisibility: (id, visible) => {
    get().commit((tree) => setNodeVisibility(tree, id, visible));
  },

  setProps: (id, patch) => {
    get().commit((tree) => setNodeProps(tree, id, patch));
  },

  previewProps: (id, patch) => {
    set({ tree: setNodeProps(get().tree, id, patch) });
  },

  moveNode: (nodeId, newParentId, position) => {
    get().commit((tree) => moveNode(tree, nodeId, newParentId, position));
  },

  insertNode: (node, parentId, position) => {
    get().commit((tree) => insertNode(tree, node, parentId, position));
  },

  reorderAtBreakpoint: (parentId, from, to, bp) => {
    get().commit((tree) => reorderChildAtBreakpoint(tree, parentId, from, to, bp));
  },

  setColorTokenValue: (tokenId, value) => {
    get().commit((tree) => setColorTokenValue(tree, tokenId, value));
  },

  previewColorTokenValue: (tokenId, value) => {
    set({ tree: setColorTokenValue(get().tree, tokenId, value) });
  },

  setColorTokenName: (tokenId, name) => {
    get().commit((tree) => setColorTokenName(tree, tokenId, name));
  },

  setTypographyToken: (tokenId, patch) => {
    get().commit((tree) => setTypographyToken(tree, tokenId, patch));
  },

  addColorToken: (token) => {
    get().commit((tree) => addColorToken(tree, token));
  },

  removeColorToken: (tokenId) => {
    get().commit((tree) => removeColorToken(tree, tokenId));
  },

  setStyle: (id, bp, key, value) => {
    get().commit((tree) => setNodeStyle(tree, id, bp, key, value));
  },

  beginStyleSession: () => {
    if (get().editBaseline === null) set({ editBaseline: get().tree });
  },

  previewStyle: (id, bp, key, value) => {
    set({ tree: setNodeStyle(get().tree, id, bp, key, value) });
  },

  commitStyleSession: () => {
    const { editBaseline, tree, past } = get();
    // Nothing to commit, or the drag produced no net change.
    if (editBaseline === null || editBaseline === tree) {
      set({ editBaseline: null });
      return;
    }
    set({
      tree,
      past: [...past, editBaseline].slice(-HISTORY_LIMIT),
      future: [],
      editBaseline: null,
    });
  },

  beginEditSession: () => {
    // Capture the baseline once; guard against double-begin.
    if (get().editBaseline === null) set({ editBaseline: get().tree });
  },

  previewContent: (id, text) => {
    set({ tree: setNodeContent(get().tree, id, text) });
  },

  commitEditSession: (id, text) => {
    const { editBaseline, tree, past } = get();
    const baseline = editBaseline ?? tree;
    const finalTree = setNodeContent(tree, id, text);
    // Compare the committed content against the baseline's value (not by
    // object identity — setNodeContent always rebuilds). If the text is
    // unchanged across the whole session, add no history entry.
    const baselineNode = findNode(baseline, id);
    const baselineContent =
      baselineNode && 'props' in baselineNode
        ? (baselineNode.props as { content?: string }).content
        : undefined;
    if (baselineContent === text) {
      set({ tree: baseline, editBaseline: null });
      return;
    }
    set({
      tree: finalTree,
      past: [...past, baseline].slice(-HISTORY_LIMIT),
      future: [],
      editBaseline: null,
    });
  },

  cancelEditSession: () => {
    const { editBaseline } = get();
    if (editBaseline) set({ tree: editBaseline, editBaseline: null });
    else set({ editBaseline: null });
  },

  undo: () => {
    const { past, tree, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1]!;
    set({
      tree: previous,
      past: past.slice(0, -1),
      future: [tree, ...future].slice(0, HISTORY_LIMIT),
      editBaseline: null,
    });
  },

  redo: () => {
    const { past, tree, future } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set({
      tree: next,
      past: [...past, tree].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      editBaseline: null,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
