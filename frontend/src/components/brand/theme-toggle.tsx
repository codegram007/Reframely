import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/theme-store';
import { IconButton } from '@/components/ui/icon-button';

/** Light/dark toggle wired to the theme store. */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <IconButton
      label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      variant="ghost"
      size="md"
      onClick={toggleTheme}
    >
      {isDark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </IconButton>
  );
}
