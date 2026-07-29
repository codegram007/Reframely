import { create } from 'zustand';

/**
 * Canvas selection + hover state, keyed by widget-tree node id. Shared
 * so the layers panel and property inspector (later prompts) stay in
 * sync with what's clicked on the canvas.
 */
interface SelectionState {
  selectedId: string | null;
  hoverId: string | null;
  /** The node currently in inline text-edit mode, if any. */
  editingId: string | null;
  setSelected: (id: string | null) => void;
  setHover: (id: string | null) => void;
  setEditing: (id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedId: null,
  hoverId: null,
  editingId: null,
  setSelected: (id) =>
    // Changing selection ends any active edit.
    set((s) => (id === s.selectedId ? { selectedId: id } : { selectedId: id, editingId: null })),
  setHover: (id) => set({ hoverId: id }),
  setEditing: (id) => set({ editingId: id }),
}));
