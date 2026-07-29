import { useEffect, useRef } from 'react';
import { useTreeStore } from '@/stores/tree-store';
import { scheduleVersionAutosave } from '@/lib/version-persist';

/**
 * After every real commit (past stack grows), schedule a debounced
 * durable version save (F15). Undo/redo and live previews do not
 * trigger saves — only forward mutations do.
 *
 * Backend B8/B9 is preferred; localStorage is the frontend-first stopgap.
 */
export function useVersionAutosave(projectId: string | undefined): void {
  const pastLenRef = useRef(useTreeStore.getState().past.length);

  useEffect(() => {
    if (!projectId) return;

    pastLenRef.current = useTreeStore.getState().past.length;

    return useTreeStore.subscribe((state) => {
      const prevLen = pastLenRef.current;
      const nextLen = state.past.length;
      pastLenRef.current = nextLen;

      // past grew ⇒ a commit landed a new undo entry
      if (nextLen > prevLen) {
        scheduleVersionAutosave(projectId, state.tree);
      }
    });
  }, [projectId]);
}
