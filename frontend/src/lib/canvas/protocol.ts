/**
 * postMessage protocol between the editor (parent) and the canvas iframe.
 *
 * The iframe is sandboxed WITHOUT allow-same-origin, so it can't touch
 * the parent's DOM or storage — all coordination flows through these
 * typed messages. Node identity is the widget-tree node id (the iframe
 * derives it from each element's `vs-{id}` class / id).
 *
 * Bounding boxes are reported in the iframe's own viewport coordinates;
 * the parent adds the iframe's offset to position overlays on top.
 */

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which edge of a drop-target node an insertion lands on. */
export type DropEdge = 'before' | 'after' | 'inside';

/** Parent → iframe. */
export type EditorToCanvasMessage =
  | { source: 'vs-editor'; type: 'select'; nodeId: string | null }
  | { source: 'vs-editor'; type: 'request-rect'; nodeId: string }
  // Ask for the rects of many nodes at once (used to position override
  // badges for every node that carries breakpoint-specific styles).
  | { source: 'vs-editor'; type: 'request-rects'; nodeIds: string[] }
  // Palette drag hit-test: the pointer is at (x, y) in the iframe's own
  // viewport coords; the bridge replies with a `drop-target`.
  | { source: 'vs-editor'; type: 'drop-probe'; x: number; y: number }
  // Enter inline edit mode for a text/heading node (makes it
  // contentEditable and focuses it).
  | { source: 'vs-editor'; type: 'enter-edit'; nodeId: string }
  // Leave edit mode. `commit` keeps the typed text; otherwise the parent
  // has already reverted the tree.
  | { source: 'vs-editor'; type: 'exit-edit'; nodeId: string; commit: boolean };

/** iframe → parent. */
export type CanvasToEditorMessage =
  | { source: 'vs-canvas'; type: 'ready' }
  | { source: 'vs-canvas'; type: 'hover'; nodeId: string | null; rect: NodeRect | null }
  | { source: 'vs-canvas'; type: 'select'; nodeId: string | null; rect: NodeRect | null }
  | { source: 'vs-canvas'; type: 'rect'; nodeId: string; rect: NodeRect | null }
  // Rects for a batch of nodes (reply to `request-rects`). Missing/removed
  // nodes are simply absent from the map.
  | { source: 'vs-canvas'; type: 'rects'; rects: Record<string, NodeRect> }
  // Reply to `drop-probe`: the node under the pointer, its rect, and which
  // edge the pointer is nearest. nodeId null when over empty page body.
  | {
      source: 'vs-canvas';
      type: 'drop-target';
      nodeId: string | null;
      rect: NodeRect | null;
      edge: DropEdge;
    }
  // The user re-clicked/double-clicked an already-selected editable node,
  // asking to start editing it.
  | { source: 'vs-canvas'; type: 'request-edit'; nodeId: string }
  // Editing began (contentEditable focused) — the parent snapshots the
  // tree for a single undo step.
  | { source: 'vs-canvas'; type: 'edit-begin'; nodeId: string }
  // Debounced live text as the user types (plain text, formatting stripped).
  | { source: 'vs-canvas'; type: 'edit-input'; nodeId: string; text: string }
  // Edit finished (Enter / blur / Escape). `commit` false means Escape
  // (revert); true means keep. `text` is the final plain text.
  | { source: 'vs-canvas'; type: 'edit-commit'; nodeId: string; text: string; commit: boolean }
  | {
      source: 'vs-canvas';
      type: 'scroll-or-resize';
      /** Fresh rects for the currently hovered + selected nodes. */
      hoverRect: NodeRect | null;
      selectedRect: NodeRect | null;
    };

export const CANVAS_SOURCE = 'vs-canvas';
export const EDITOR_SOURCE = 'vs-editor';

export function isCanvasMessage(data: unknown): data is CanvasToEditorMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === CANVAS_SOURCE
  );
}
