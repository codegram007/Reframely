import { Undo2, Redo2 } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { Tooltip } from '@/components/ui/tooltip';
import { useTreeStore } from '@/stores/tree-store';

/** Platform-aware modifier hint for the tooltips. */
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/**
 * Undo/redo buttons for the editor top bar (F15), wired to the unified
 * tree-store history. Every mutation path (panels, drag, code-sync apply,
 * palette insert, tokens) pushes one entry via `commit`. Shortcuts are
 * handled editor-wide by `useEditorHistoryShortcuts`.
 */
export function UndoRedoControls() {
  const canUndo = useTreeStore((s) => s.past.length > 0);
  const canRedo = useTreeStore((s) => s.future.length > 0);
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip label={`Undo (${MOD}Z)`} side="bottom">
        <IconButton label="Undo" variant="ghost" size="md" disabled={!canUndo} onClick={undo}>
          <Undo2 className="h-[18px] w-[18px]" />
        </IconButton>
      </Tooltip>
      <Tooltip label={`Redo (${MOD}⇧Z / ${MOD}Y)`} side="bottom">
        <IconButton label="Redo" variant="ghost" size="md" disabled={!canRedo} onClick={redo}>
          <Redo2 className="h-[18px] w-[18px]" />
        </IconButton>
      </Tooltip>
    </div>
  );
}
