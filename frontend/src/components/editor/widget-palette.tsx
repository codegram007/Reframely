import { useMemo, useRef } from 'react';
import {
  FileCode2,
  Heading,
  Image as ImageIcon,
  LayoutGrid,
  Minus,
  MousePointerClick,
  MoveVertical,
  Quote,
  SquareStack,
  Star,
  TextCursorInput,
  Type,
  type LucideIcon,
} from 'lucide-react';
import {
  PALETTE,
  styleContext,
  type PaletteGroup,
  type PaletteItem,
} from '@/lib/widget-factory';
import { resolveInsert } from '@/lib/tree-move';
import { useTreeStore } from '@/stores/tree-store';
import { useSelectionStore } from '@/stores/selection-store';
import { useEditorUiStore } from '@/stores/editor-ui-store';
import { DragGhost } from './drag-ghost';

/** Icon-name → component. Keeps PALETTE data-only (string names). */
const ICONS: Record<string, LucideIcon> = {
  Heading,
  Type,
  MousePointerClick,
  Star,
  MoveVertical,
  Minus,
  Image: ImageIcon,
  LayoutGrid,
  FileCode2,
  SquareStack,
  Quote,
  TextCursorInput,
};

const GROUP_ORDER: PaletteGroup[] = ['Basic', 'Media', 'Composite'];

/** Pixels of movement before a press becomes a free-drag (not a click). */
const DRAG_THRESHOLD = 6;

/**
 * Widget palette (F11) — free-drag cards onto the canvas.
 *
 * Lifecycle (shared with canvas.tsx, not dnd-kit):
 *   1. pointerdown → capture pointer on the card
 *   2. after DRAG_THRESHOLD px of movement → set paletteDragKey + ghost
 *   3. pointermove (window) → update freeDragPoint; canvas drop-probes iframe
 *   4. pointerup over canvas → canvas inserts at drop indicator; clear key
 *   5. stationary pointerup → click-insert at selection (explicit shortcut)
 *
 * Root-cause fix: earlier code only listened for pointermove on the card,
 * so moving onto the canvas never set `dragging=true` and pointerup always
 * ran click-insert (jump to default position).
 */
export function WidgetPalette() {
  const tree = useTreeStore((s) => s.tree);
  const insertNode = useTreeStore((s) => s.insertNode);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const setPaletteDragKey = useEditorUiStore((s) => s.setPaletteDragKey);
  const setFreeDragPoint = useEditorUiStore((s) => s.setFreeDragPoint);
  const paletteDragKey = useEditorUiStore((s) => s.paletteDragKey);
  const freeDragPoint = useEditorUiStore((s) => s.freeDragPoint);

  const groups = useMemo(() => {
    const by: Record<PaletteGroup, PaletteItem[]> = {
      Basic: [],
      Media: [],
      Composite: [],
    };
    for (const item of PALETTE) by[item.group].push(item);
    return GROUP_ORDER.map((g) => ({ group: g, items: by[g] }));
  }, []);

  // Click-to-insert: only when the user did not drag (see PaletteCard).
  const clickInsert = (item: PaletteItem) => {
    const node = item.build(styleContext(tree));
    const targetId = selectedId ?? tree.root.id;
    const target =
      resolveInsert(tree, item.nodeType, targetId, 'after') ??
      resolveInsert(tree, item.nodeType, tree.root.id, 'inside');
    if (target) {
      insertNode(node, target.parentId, target.position);
      setSelected(node.id);
    }
  };

  const dragItem = paletteDragKey
    ? PALETTE.find((p) => p.key === paletteDragKey)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <p className="mb-3 px-1 text-xs text-muted-foreground">
        Drag a widget onto the canvas — drop where the highlight shows. Click
        without moving to insert at the current selection.
      </p>
      {groups.map(({ group, items }) => (
        <section key={group} className="mb-4">
          <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <PaletteCard
                key={item.key}
                item={item}
                dragging={paletteDragKey === item.key}
                onDragBegin={(x, y) => {
                  setPaletteDragKey(item.key);
                  setFreeDragPoint({ x, y });
                }}
                onDragMove={(x, y) => setFreeDragPoint({ x, y })}
                onClick={() => clickInsert(item)}
              />
            ))}
          </div>
        </section>
      ))}

      {dragItem && freeDragPoint && (
        <DragGhost label={dragItem.label} x={freeDragPoint.x} y={freeDragPoint.y} />
      )}
    </div>
  );
}

function PaletteCard({
  item,
  dragging,
  onDragBegin,
  onDragMove,
  onClick,
}: {
  item: PaletteItem;
  dragging: boolean;
  onDragBegin: (x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onClick: () => void;
}) {
  const Icon = ICONS[item.icon] ?? SquareStack;
  const session = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);

  return (
    <button
      type="button"
      aria-label={`Insert ${item.label}`}
      className={[
        'flex touch-none flex-col items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-3',
        'cursor-grab text-xs text-foreground transition-colors active:cursor-grabbing',
        'hover:border-accent hover:bg-accent/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        dragging ? 'opacity-40' : '',
      ].join(' ')}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // Capture so move/up still fire after the pointer leaves this card.
        e.currentTarget.setPointerCapture(e.pointerId);
        session.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          dragging: false,
        };
      }}
      onPointerMove={(e) => {
        const s = session.current;
        if (!s || s.pointerId !== e.pointerId) return;
        if (!s.dragging) {
          const dx = e.clientX - s.startX;
          const dy = e.clientY - s.startY;
          if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
          s.dragging = true;
          onDragBegin(e.clientX, e.clientY);
        } else {
          onDragMove(e.clientX, e.clientY);
        }
      }}
      onPointerUp={(e) => {
        const s = session.current;
        session.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        // Free-drag ends in canvas.tsx (window pointerup while paletteDragKey
        // is set). Stationary press = click-insert shortcut.
        if (s && !s.dragging) onClick();
      }}
      onPointerCancel={(e) => {
        session.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
        useEditorUiStore.getState().setPaletteDragKey(null);
      }}
    >
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <span className="leading-none">{item.label}</span>
    </button>
  );
}
