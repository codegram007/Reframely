import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'vibestudio-theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Applies the theme to <html> and persists the explicit choice. */
function apply(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

interface ThemeState {
  theme: Theme;
  /** True until the user makes an explicit choice — follows the OS. */
  isSystem: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Theme store. Initial value mirrors what the anti-FOUC script in
 * index.html already applied: stored choice, else prefers-color-scheme.
 * While the user hasn't chosen explicitly, we keep following the OS.
 */
export const useThemeStore = create<ThemeState>((set, get) => {
  const stored = readStored();
  const initial: Theme = stored ?? systemTheme();

  if (typeof window !== 'undefined') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => {
      if (get().isSystem) {
        const next: Theme = e.matches ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', next === 'dark');
        set({ theme: next });
      }
    });
  }

  return {
    theme: initial,
    isSystem: stored === null,
    setTheme: (theme) => {
      apply(theme);
      set({ theme, isSystem: false });
    },
    toggleTheme: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      apply(next);
      set({ theme: next, isSystem: false });
    },
  };
});
