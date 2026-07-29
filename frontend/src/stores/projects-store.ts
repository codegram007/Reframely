import { create } from 'zustand';

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
}

/**
 * Projects store. Seeded empty for F1 so the dashboard shows its empty
 * state; later prompts will hydrate this from the import/list API.
 */
export const useProjectsStore = create<ProjectsState>((_set, get) => ({
  projects: [],
  getProject: (id) => get().projects.find((p) => p.id === id),
}));
