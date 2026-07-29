import { useEffect } from 'react';
import { useTreeStore } from '@/stores/tree-store';
import { useCodeViewStore } from '@/stores/code-view-store';
import { useSelectionStore } from '@/stores/selection-store';

/**
 * True when the event target is a native/text-editing surface where the
 * browser or Monaco should own Cmd/Ctrl+Z (not the tree undo stack).
 *
 * When Monaco is open read-only, tree undo still owns Z — only hand-edit
 * mode (F14) yields the key to Monaco's buffer history.
 */
function isTextEditingTarget(
  target: EventTarget | null,
  opts: { monacoOwnsUndo: boolean },
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (opts.monacoOwnsUndo && target.closest('.monaco-editor')) return true;
  return false;
}

/**
 * Editor-wide undo/redo shortcuts (F15).
 *
 * Mount once on the editor page so shortcuts work in Design and Code
 * views, style/content panels, and layers — not only when the canvas
 * iframe host is mounted.
 *
 * Does NOT steal keys from:
 * - focused form fields
 * - contenteditable (inline canvas text is handled by the bridge)
 * - Monaco while Code View is open (read-only OR editable — Monaco still
 *   receives focus; tree undo is available via the toolbar buttons)
 *
 * When Code View is open and editable, tree undo is intentionally off
 * the keyboard path so raw-code buffer undo stays predictable.
 */
export function useEditorHistoryShortcuts(): void {
  const undo = useTreeStore((s) => s.undo);
  const redo = useTreeStore((s) => s.redo);
  const codeOpen = useCodeViewStore((s) => s.open);
  const codeEditable = useCodeViewStore((s) => s.editable);
  const editingId = useSelectionStore((s) => s.editingId);
  const setSelected = useSelectionStore((s) => s.setSelected);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Escape: deselect when not mid inline-edit (canvas bridge handles in-frame).
      if (e.key === 'Escape' && editingId === null && !codeEditable) {
        setSelected(null);
        return;
      }

      if (!mod) return;

      // While hand-editing code, leave Z/Y entirely to Monaco (even if
      // focus is outside the editor chrome for a moment).
      if (codeOpen && codeEditable) return;
      if (isTextEditingTarget(e.target, { monacoOwnsUndo: false })) return;

      // Cmd/Ctrl+Z → undo; Shift+Cmd/Ctrl+Z or Cmd/Ctrl+Y → redo
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (key === 'y' && !e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, codeOpen, codeEditable, editingId, setSelected]);
}
