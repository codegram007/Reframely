import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ProjectStatus = 'imported' | 'snapshotted' | 'classified' | 'ready' | 'deployed';

export interface Project {
  id: string;
  name: string;
  /** Origin the project was imported from (URL, repo, or filename). */
  origin: string;
  status: ProjectStatus;
  /** Page count discovered during import. */
  pageCount: number;
  updatedAt: string; // ISO
  /** Optional deployed URL once published. */
  deployedUrl?: string;
}

interface ProjectsState {
  projects: Project[];
  getProject: (id: string) => Project | undefined;
  upsertProject: (project: Project) => void;
  markProjectSaved: (id: string) => void;
}

/**
 * Projects store. Seeded empty for F1 so the dashboard shows its empty
 * state; later prompts will hydrate this from the import/list API.
 */
export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      getProject: (id) => get().projects.find((p) => p.id === id),
      upsertProject: (project) =>
        set((state) => ({
          projects: [project, ...state.projects.filter((p) => p.id !== project.id)],
        })),
      markProjectSaved: (id) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, status: 'ready', updatedAt: new Date().toISOString() }
              : project,
          ),
        })),
    }),
    {
      name: 'reframely:projects',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ projects: state.projects }),
    },
  ),
);
