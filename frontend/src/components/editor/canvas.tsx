import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { generatePage } from '@/lib/codegen';
import { CANVAS_BRIDGE_SCRIPT } from '@/lib/canvas/bridge-script';
import {
  EDITOR_SOURCE,
  isCanvasMessage,
  type DropEdge,
  type EditorToCanvasMessage,
  type NodeRect,
} from '@/lib/canvas/protocol';
import { useSelectionStore } from '@/stores/selection-store';
import { useTreeStore } from '@/stores/tree-store';
import { useEditorUiStore } from '@/stores/editor-ui-store';
import { useAssistantStore } from '@/stores/assistant-store';
import { findNode, findNodePath, nodeLabel } from '@/lib/tree-index';
import { hasOverrides } from '@/lib/style-engine';
import { visualOrder } from '@/lib/tree-reorder-bp';
import { isEditable } from '@/lib/tree-edit';
import { canMove, siblingInfo, resolveInsert } from '@/lib/tree-move';
import { PALETTE, styleContext } from '@/lib/widget-factory';
import type { TreeNode } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { SelectionBreadcrumb } from './selection-breadcrumb';
import { DragGhost } from './drag-ghost';

interface CanvasProps {
  /** Rendered frame width in px (driven by the breakpoint switcher). */
  frameWidth: number;
}

/**
 * The live canvas. Compiles the widget tree to standalone HTML/CSS
 * (client-side, same codegen the backend uses) and renders it in a
 * sandboxed iframe. Hover/select/geometry/text-edits are exchanged with
 * the iframe over postMessage; the parent draws outline overlays on top
 * rather than reaching into the iframe's DOM.
 *
 * Sandbox: `allow-scripts` so preserved `behaviors` scripts run, but NOT
 * `allow-same-origin` — the frame is a null origin that cannot read the
 * parent app, its cookies, or storage.
 */
export function Canvas({ frameWidth }: CanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tree = useTreeStore((s) => s.tree);
  const beginEditSession = useTreeStore((s) => s.beginEditSession);
  const previewContent = useTreeStore((s) => s.previewContent);
  const commitEditSession = useTreeStore((s) => s.commitEditSession);
  const cancelEditSession = useTreeStore((s) => s.cancelEditSession);
  const moveNode = useTreeStore((s) => s.moveNode);
  const reorderAtBreakpoint = useTreeStore((s) => s.reorderAtBreakpoint);
  const insertNode = useTreeStore((s) => s.insertNode);

  const selectedId = useSelectionStore((s) => s.selectedId);
  const hoverId = useSelectionStore((s) => s.hoverId);
  const editingId = useSelectionStore((s) => s.editingId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const setHover = useSelectionStore((s) => s.setHover);
  const setEditing = useSelectionStore((s) => s.setEditing);

  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const paletteDragKey = useEditorUiStore((s) => s.paletteDragKey);
  const setPaletteDragKey = useEditorUiStore((s) => s.setPaletteDragKey);
  const freeDragPoint = useEditorUiStore((s) => s.freeDragPoint);
  const setFreeDragPoint = useEditorUiStore((s) => s.setFreeDragPoint);
  const canvasMoveId = useEditorUiStore((s) => s.canvasMoveId);
  const setCanvasMoveId = useEditorUiStore((s) => s.setCanvasMoveId);
  const setSelectedGlobal = useSelectionStore((s) => s.setSelected);
  const freeDragActive = Boolean(paletteDragKey || canvasMoveId);

  // F17: highlight nodes affected by a pending AI patch (preview only).
  const pendingPatch = useAssistantStore((s) => s.pendingPatch);
  const previewIds = pendingPatch?.affectedNodeIds ?? [];

  const [hoverRect, setHoverRect] = useState<NodeRect | null>(null);
  const [selectedRect, setSelectedRect] = useState<NodeRect | null>(null);
  const [badgeRects, setBadgeRects] = useState<Record<string, NodeRect>>({});
  // Live drop target during a palette drag (null when not dragging/over gap).
  const [dropTarget, setDropTarget] = useState<{
    nodeId: string | null;
    rect: NodeRect | null;
    edge: DropEdge;
  } | null>(null);
  const dropTargetRef = useRef(dropTarget);
  dropTargetRef.current = dropTarget;

  // Resolve selection/hover ids to their node path for labels + breadcrumb.
  const selectedPath = useMemo(
    () => (selectedId ? findNodePath(tree, selectedId) : null),
    [tree, selectedId],
  );
  const selectedNode = selectedPath?.[selectedPath.length - 1] ?? null;
  const hoverNode = useMemo<TreeNode | null>(() => {
    if (!hoverId || hoverId === selectedId) return null;
    const path = findNodePath(tree, hoverId);
    return path?.[path.length - 1] ?? null;
  }, [tree, hoverId, selectedId]);

  // Sibling-reorder for the selected section/column (canvas drag source).
  // Rows/widgets reorder from the layers panel; on canvas we expose the
  // two container levels the PRD calls out (section, column).
  //
  // On a NON-desktop breakpoint, a column reorder is breakpoint-scoped: it
  // writes CSS `order` overrides (restacking just this breakpoint) instead
  // of mutating the shared structural order. This is the PRD's mobile
  // stacked-layout case — same up/down UI, breakpoint-local result.
  const reorder = useMemo(() => {
    if (!selectedNode || (selectedNode.type !== 'section' && selectedNode.type !== 'column')) {
      return null;
    }

    if (breakpoint !== 'desktop' && selectedNode.type === 'column') {
      const parent = selectedPath?.[selectedPath.length - 2] ?? null;
      if (!parent || parent.type === 'widget') return null;
      const order = visualOrder(parent, breakpoint);
      if (order.length < 2) return null;
      const from = order.indexOf(selectedNode.id);
      const parentId = parent.id;
      return {
        canUp: from > 0,
        canDown: from < order.length - 1,
        moveUp: () => reorderAtBreakpoint(parentId, from, from - 1, breakpoint),
        moveDown: () => reorderAtBreakpoint(parentId, from, from + 1, breakpoint),
      };
    }

    const info = siblingInfo(tree, selectedNode.id);
    if (!info || info.count < 2) return null;
    return {
      canUp: info.index > 0,
      canDown: info.index < info.count - 1,
      moveUp: () => moveNode(selectedNode.id, info.parentId, info.index - 1),
      moveDown: () => moveNode(selectedNode.id, info.parentId, info.index + 1),
    };
  }, [tree, selectedNode, selectedPath, breakpoint, moveNode, reorderAtBreakpoint]);

  // Ids of nodes carrying breakpoint-specific overrides at the active
  // breakpoint — these get a small badge on canvas. Empty on desktop
  // (the base layer, which has no "overrides").
  const overriddenIds = useMemo(() => {
    if (breakpoint === 'desktop') return [] as string[];
    const ids: string[] = [];
    const walk = (n: TreeNode) => {
      if (hasOverrides(n, breakpoint)) ids.push(n.id);
      if (n.type !== 'widget') (n.children as TreeNode[]).forEach(walk);
    };
    walk(tree.root);
    return ids;
  }, [tree, breakpoint]);
  const overriddenKey = overriddenIds.join(',');

  // CRITICAL: while a text edit is in progress the iframe owns the live
  // text (contentEditable). Recompiling srcDoc would reload the frame and
  // destroy the editable region + caret. So we freeze the rendered tree
  // for the duration of the session and only pick up the committed tree
  // once editing ends. `renderTree` is the tree we actually compile from.
  const frozenTreeRef = useRef(tree);
  if (editingId === null) frozenTreeRef.current = tree;
  const renderTree = editingId === null ? tree : frozenTreeRef.current;

  const srcDoc = useMemo(() => {
    const { html } = generatePage(renderTree);
    const bridge = `<script>${CANVAS_BRIDGE_SCRIPT}</script>`;
    return html.replace('</head>', `${bridge}\n</head>`);
  }, [renderTree]);

  const post = (msg: EditorToCanvasMessage) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  };

  // Listen for canvas → editor messages.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (!isCanvasMessage(e.data)) return;
      const msg = e.data;
      switch (msg.type) {
        case 'hover':
          setHover(msg.nodeId);
          setHoverRect(msg.rect);
          break;
        case 'select':
          setSelected(msg.nodeId);
          setSelectedRect(msg.rect);
          break;
        case 'rect':
          if (msg.nodeId === selectedId) setSelectedRect(msg.rect);
          break;
        case 'rects':
          setBadgeRects(msg.rects);
          break;
        case 'drop-target':
          setDropTarget({ nodeId: msg.nodeId, rect: msg.rect, edge: msg.edge });
          break;
        case 'request-edit': {
          // The iframe asked to edit a node; only allow text/heading.
          const node = findNode(tree, msg.nodeId);
          if (node && isEditable(node)) {
            setEditing(msg.nodeId);
            post({ source: EDITOR_SOURCE, type: 'enter-edit', nodeId: msg.nodeId });
          }
          break;
        }
        case 'edit-begin':
          // Snapshot the tree once so the whole session is one undo step.
          beginEditSession();
          break;
        case 'edit-input':
          // Debounced live text — update the working tree, no history.
          previewContent(msg.nodeId, msg.text);
          break;
        case 'edit-commit':
          if (msg.commit) commitEditSession(msg.nodeId, msg.text);
          else cancelEditSession();
          setEditing(null);
          break;
        case 'scroll-or-resize':
          setHoverRect(msg.hoverRect);
          setSelectedRect(msg.selectedRect);
          break;
        case 'ready':
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, tree]);

  // Push external selection changes (breadcrumb, layers panel, deselect)
  // into the iframe so its internal state + our overlay stay in sync.
  // Skipped while editing so we don't disturb the contentEditable.
  useEffect(() => {
    if (editingId !== null) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: EDITOR_SOURCE, type: 'select', nodeId: selectedId }, '*');
    if (selectedId === null) setSelectedRect(null);
  }, [selectedId, srcDoc, editingId]);

  // Request rects for override badges + AI preview highlights whenever
  // the set changes or the frame re-renders (srcDoc). Clearing when empty
  // so stale overlays don't linger. The iframe re-reports on scroll/resize.
  const previewKey = previewIds.join(',');
  const rectRequestIds = useMemo(() => {
    const set = new Set<string>([...overriddenIds, ...previewIds]);
    return [...set];
  }, [overriddenKey, previewKey, overriddenIds, previewIds]);

  useEffect(() => {
    if (rectRequestIds.length === 0) {
      setBadgeRects({});
      return;
    }
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    // Defer one frame so the iframe has laid out the freshly-set srcDoc.
    const id = requestAnimationFrame(() => {
      win.postMessage(
        { source: EDITOR_SOURCE, type: 'request-rects', nodeIds: rectRequestIds },
        '*',
      );
    });
    return () => cancelAnimationFrame(id);
  }, [rectRequestIds, srcDoc]);

  // ---- Free-drag (palette insert + canvas move): probe iframe, commit on up ----
  // Shared continuous-drag path: cursor ghost (DragGhost) + DropIndicator.
  // Not dnd-kit — the canvas is a sandboxed iframe, so droppables live in the
  // bridge (drop-probe) rather than useDroppable.
  const clearFreeDrag = () => {
    setDropTarget(null);
    setPaletteDragKey(null);
    setCanvasMoveId(null);
    setFreeDragPoint(null);
  };

  const performFreeDrop = (clientX: number, clientY: number) => {
    const frame = iframeRef.current;
    if (!frame) return;
    const box = frame.getBoundingClientRect();
    const inside =
      clientX >= box.left &&
      clientX <= box.right &&
      clientY >= box.top &&
      clientY <= box.bottom;

    const dt = dropTargetRef.current;
    const targetId = inside && dt?.nodeId ? dt.nodeId : tree.root.id;
    const edge: DropEdge = inside && dt ? dt.edge : 'inside';

    // Palette insert
    if (paletteDragKey) {
      if (!inside) return; // cancel if released outside the frame
      const item = PALETTE.find((p) => p.key === paletteDragKey);
      if (!item) return;
      const node = item.build(styleContext(tree));
      const target = resolveInsert(tree, item.nodeType, targetId, edge);
      if (target) {
        insertNode(node, target.parentId, target.position);
        setSelectedGlobal(node.id);
      }
      return;
    }

    // Canvas move of an existing node
    if (canvasMoveId) {
      if (!inside) return;
      const moving = findNode(tree, canvasMoveId);
      if (!moving || moving.type === 'page') return;
      const target = resolveInsert(tree, moving.type, targetId, edge);
      if (target && canMove(tree, canvasMoveId, target.parentId)) {
        moveNode(canvasMoveId, target.parentId, target.position);
      }
    }
  };

  useEffect(() => {
    if (!freeDragActive) return;
    const frame = iframeRef.current;

    const onMove = (e: PointerEvent) => {
      setFreeDragPoint({ x: e.clientX, y: e.clientY });
      const win = frame?.contentWindow;
      const box = frame?.getBoundingClientRect();
      if (!win || !box) return;
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      if (x < 0 || y < 0 || x > box.width || y > box.height) {
        setDropTarget(null);
        return;
      }
      win.postMessage({ source: EDITOR_SOURCE, type: 'drop-probe', x, y }, '*');
    };

    const onUp = (e: PointerEvent) => {
      performFreeDrop(e.clientX, e.clientY);
      clearFreeDrag();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearFreeDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeDragActive, paletteDragKey, canvasMoveId, tree]);

  // Undo/redo + Escape deselect live on the editor page (F15) so they work
  // in Design and Code views alike. Canvas only owns pointer/bridge input.

  return (
    <div className="flex h-full w-full flex-col">
      {/* Ancestor breadcrumb — one-click select-parent. */}
      <SelectionBreadcrumb path={selectedPath} onSelect={setSelected} />

      {/* Click-outside the frame (on the canvas gutter) deselects. */}
      <div
        className="relative flex min-h-0 flex-1 items-start justify-center overflow-auto p-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSelected(null);
        }}
      >
        <div
          className="relative shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-md transition-[width] duration-200 ease-out-expo"
          style={{ width: frameWidth, maxWidth: '100%' }}
        >
          <iframe
            ref={iframeRef}
            title="Canvas preview"
            srcDoc={srcDoc}
            // allow-scripts runs preserved behaviors; NO allow-same-origin,
            // so the frame is a null origin isolated from the parent app.
            sandbox="allow-scripts"
            className="block h-[80vh] w-full border-0 bg-white"
          />

          {/* Breakpoint-override badges: a small dot on the top-right of
              every node that has overrides at the active breakpoint. Hidden
              while editing to reduce clutter. pointer-events-none. */}
          {!editingId &&
            overriddenIds.map((id) => {
              const r = badgeRects[id];
              if (!r || r.width === 0) return null;
              return (
                <div
                  key={id}
                  aria-hidden="true"
                  className="pointer-events-none absolute z-20"
                  style={{ transform: `translate(${r.x + r.width - 7}px, ${r.y + 1}px)`, left: 0, top: 0 }}
                >
                  <span
                    title={`Has ${breakpoint} overrides`}
                    className="block h-2 w-2 rounded-full bg-warning shadow-[0_0_0_1.5px_hsl(var(--surface))]"
                  />
                </div>
              );
            })}

          {/* F17: AI patch preview — dashed accent outlines on affected nodes.
              Patch is NOT applied yet; Accept/Reject live in the assistant panel. */}
          {previewIds.map((id) => {
            const r = badgeRects[id];
            if (!r || r.width === 0) return null;
            return (
              <div
                key={`ai-${id}`}
                aria-hidden="true"
                className="pointer-events-none absolute z-30 rounded-[3px] ring-2 ring-dashed ring-accent shadow-[0_0_0_1px_hsl(var(--accent)/0.25)]"
                style={{
                  transform: `translate(${r.x}px, ${r.y}px)`,
                  left: 0,
                  top: 0,
                  width: r.width,
                  height: r.height,
                  background: 'hsl(var(--accent) / 0.1)',
                }}
              >
                <span className="absolute -top-5 left-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                  AI preview
                </span>
              </div>
            );
          })}

          {/* Overlays live in the parent, positioned over the iframe using
              the rects the bridge reports. pointer-events-none so they
              never intercept clicks meant for the canvas. */}
          {hoverNode && !editingId && (
            <Overlay rect={hoverRect} variant="hover" label={nodeLabel(hoverNode)} />
          )}
          {selectedNode && (
            <Overlay
              rect={selectedRect}
              variant={editingId ? 'editing' : 'selected'}
              label={editingId ? `Editing ${nodeLabel(selectedNode)}` : nodeLabel(selectedNode)}
              reorder={editingId ? null : reorder}
              onMoveDragStart={
                editingId || selectedNode.type === 'page'
                  ? null
                  : (x, y) => {
                      setCanvasMoveId(selectedNode.id);
                      setFreeDragPoint({ x, y });
                    }
              }
            />
          )}

          {/* Drop indicator while free-dragging (palette or canvas move). */}
          {freeDragActive && dropTarget?.rect && (
            <DropIndicator rect={dropTarget.rect} edge={dropTarget.edge} />
          )}
        </div>
      </div>

      {canvasMoveId && freeDragPoint && (
        <DragGhost
          label={nodeLabel(findNode(tree, canvasMoveId) ?? tree.root)}
          x={freeDragPoint.x}
          y={freeDragPoint.y}
        />
      )}
    </div>
  );
}

function DropIndicator({ rect, edge }: { rect: NodeRect; edge: DropEdge }) {
  if (edge === 'inside') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-30 rounded-sm ring-2 ring-accent ring-offset-0"
        style={{
          transform: `translate(${rect.x}px, ${rect.y}px)`,
          left: 0,
          top: 0,
          width: rect.width,
          height: rect.height,
          background: 'hsl(var(--accent) / 0.08)',
        }}
      />
    );
  }
  const y = edge === 'before' ? rect.y : rect.y + rect.height;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-30"
      style={{ transform: `translate(${rect.x}px, ${y - 1.5}px)`, left: 0, top: 0 }}
    >
      <div className="h-[3px] rounded-full bg-accent shadow-[0_0_0_1px_hsl(var(--surface))]" style={{ width: rect.width }} />
    </div>
  );
}

interface ReorderControls {
  canUp: boolean;
  canDown: boolean;
  moveUp: () => void;
  moveDown: () => void;
}

function Overlay({
  rect,
  variant,
  label,
  reorder,
  onMoveDragStart,
}: {
  rect: NodeRect | null;
  variant: 'hover' | 'selected' | 'editing';
  label: string;
  reorder?: ReorderControls | null;
  /** Start free-drag move of the selected canvas node. */
  onMoveDragStart?: ((x: number, y: number) => void) | null;
}) {
  if (!rect || rect.width === 0) return null;
  const isSelected = variant === 'selected';
  const isEditing = variant === 'editing';
  return (
    <div
      aria-hidden={reorder || onMoveDragStart ? undefined : 'true'}
      className={cn(
        'pointer-events-none absolute z-10 rounded-[3px]',
        isEditing && 'ring-2 ring-success shadow-[0_0_0_1px_hsl(var(--success)/0.3)]',
        isSelected && 'ring-2 ring-accent shadow-[0_0_0_1px_hsl(var(--accent)/0.3)]',
        variant === 'hover' && 'ring-1 ring-accent/50',
      )}
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height,
        left: 0,
        top: 0,
      }}
    >
      <span
        className={cn(
          'absolute -top-[18px] left-0 flex items-center gap-1 whitespace-nowrap rounded-t-[3px] px-1.5 py-0.5 text-2xs font-medium leading-none',
          isEditing ? 'bg-success text-white' : 'bg-accent text-accent-foreground',
          variant === 'hover' && 'bg-accent/70',
        )}
      >
        {label}
      </span>

      {/* Free-drag handle — pointer-down starts continuous move (not click-jump). */}
      {onMoveDragStart && (
        <button
          type="button"
          aria-label="Drag to move"
          title="Drag to move"
          className="pointer-events-auto absolute -top-[22px] left-1/2 flex h-5 -translate-x-1/2 cursor-grab items-center rounded-t-[3px] bg-accent px-1.5 text-accent-foreground active:cursor-grabbing"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onMoveDragStart(e.clientX, e.clientY);
          }}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Sibling-reorder handles for the selected section/column. */}
      {reorder && (
        <div className="pointer-events-auto absolute -top-[22px] right-0 flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Move up"
            title="Move up"
            disabled={!reorder.canUp}
            onClick={reorder.moveUp}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-t-[3px] bg-accent text-accent-foreground transition-opacity hover:bg-accent-hover disabled:opacity-40"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            title="Move down"
            disabled={!reorder.canDown}
            onClick={reorder.moveDown}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-t-[3px] bg-accent text-accent-foreground transition-opacity hover:bg-accent-hover disabled:opacity-40"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
