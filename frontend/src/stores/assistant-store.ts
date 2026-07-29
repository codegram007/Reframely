import { create } from 'zustand';
import { api, ApiError, NetworkError } from '@/lib/api/client';
import { mockAssistantPatches } from '@/lib/assistant-mock';
import {
  applyTreePatch,
  isTreePatch,
  summarizePatch,
  type PatchSummary,
  type TreePatch,
} from '@/lib/tree-patch';
import { useTreeStore } from '@/stores/tree-store';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** Outcome for assistant turns that proposed a patch. */
  outcome?: 'pending' | 'accepted' | 'rejected' | 'error';
  patchId?: string;
  summary?: string;
  confidence?: number;
  rationale?: string;
}

interface AssistantState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;

  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;

  /** Patch awaiting Accept/Reject — null when none. */
  pendingPatch: TreePatch | null;
  pendingSummary: PatchSummary | null;
  sending: boolean;
  error: string | null;

  send: (projectId: string) => Promise<void>;
  accept: () => void;
  reject: () => void;
  clearHistory: () => void;
}

function mid(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggleOpen: () => set({ open: !get().open }),

  messages: [
    {
      id: 'welcome',
      role: 'system',
      content:
        'Describe a change (e.g. “make the accent purple” or “rewrite the hero headline”). I’ll propose a patch for preview — nothing applies until you Accept.',
      createdAt: new Date().toISOString(),
    },
  ],
  input: '',
  setInput: (input) => set({ input }),

  pendingPatch: null,
  pendingSummary: null,
  sending: false,
  error: null,

  send: async (projectId) => {
    const text = get().input.trim();
    if (!text || get().sending) return;
    // Don't stack proposals — reject current first.
    if (get().pendingPatch) get().reject();

    const userMsg: ChatMessage = {
      id: mid(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    set({
      messages: [...get().messages, userMsg],
      input: '',
      sending: true,
      error: null,
    });

    const tree = useTreeStore.getState().tree;

    try {
      let patches: TreePatch[] = [];
      let assistantMessage = '';

      try {
        const res = await api.runAssistant({
          projectId,
          userMessage: text,
          tree,
        });
        assistantMessage = res.assistantMessage;
        patches = res.patches.filter(isTreePatch);
      } catch (err) {
        if (!(err instanceof NetworkError || err instanceof ApiError)) throw err;
        // Frontend-first mock (B12 not wired).
        const mock = mockAssistantPatches(tree, text);
        patches = mock.patches;
        assistantMessage = mock.assistantMessage;
      }

      const patch = patches[0] ?? null;
      const summary = patch ? summarizePatch(tree, patch) : null;

      const assistantMsg: ChatMessage = {
        id: mid(),
        role: 'assistant',
        content: assistantMessage || (patch ? patch.rationale : 'No changes proposed.'),
        createdAt: new Date().toISOString(),
      };
      if (patch) {
        assistantMsg.outcome = 'pending';
        assistantMsg.patchId = patch.patchId;
        assistantMsg.confidence = patch.confidence;
        assistantMsg.rationale = patch.rationale;
        if (summary?.headline) assistantMsg.summary = summary.headline;
      }

      set({
        messages: [...get().messages, assistantMsg],
        pendingPatch: patch,
        pendingSummary: summary,
        sending: false,
      });
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: mid(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Assistant failed.',
        createdAt: new Date().toISOString(),
        outcome: 'error',
      };
      set({
        messages: [...get().messages, errorMsg],
        sending: false,
        error: errorMsg.content,
      });
    }
  },

  accept: () => {
    const patch = get().pendingPatch;
    if (!patch) return;
    useTreeStore.getState().commit((tree) => applyTreePatch(tree, patch));
    set({
      pendingPatch: null,
      pendingSummary: null,
      messages: get().messages.map((m) =>
        m.patchId === patch.patchId && m.outcome === 'pending'
          ? { ...m, outcome: 'accepted' as const }
          : m,
      ),
    });
  },

  reject: () => {
    const patch = get().pendingPatch;
    if (!patch) {
      set({ pendingPatch: null, pendingSummary: null });
      return;
    }
    set({
      pendingPatch: null,
      pendingSummary: null,
      messages: get().messages.map((m) =>
        m.patchId === patch.patchId && m.outcome === 'pending'
          ? { ...m, outcome: 'rejected' as const }
          : m,
      ),
    });
  },

  clearHistory: () =>
    set({
      messages: get().messages.filter((m) => m.role === 'system').slice(0, 1),
      pendingPatch: null,
      pendingSummary: null,
      error: null,
    }),
}));
