import { createPortal } from 'react-dom';

/**
 * Cursor-following ghost for free-drag operations that are not dnd-kit
 * (palette → canvas, canvas → canvas move). Renders in a portal so it
 * is not clipped by panel overflow.
 */
export function DragGhost({
  label,
  x,
  y,
}: {
  label: string;
  x: number;
  y: number;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[200] flex max-w-[220px] items-center gap-2 rounded-md border border-accent bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-lg"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${x + 12}px, ${y + 12}px)`,
      }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
      <span className="truncate">{label}</span>
    </div>,
    document.body,
  );
}
