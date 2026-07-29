import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelPlaceholderProps {
  title: string;
  hint: string;
  icon: ReactNode;
  className?: string;
}

/**
 * Neutral placeholder for editor panels that later prompts will fill in
 * (layers tree, style inspector, etc.). Communicates intent without
 * pretending to be functional.
 */
export function PanelPlaceholder({ title, hint, icon, className }: PanelPlaceholderProps) {
  return (
    <div className={cn('flex h-full flex-col items-center justify-center px-6 text-center', className)}>
      <div className="mb-3 rounded-xl border border-dashed border-border-strong bg-surface-sunken p-3 text-foreground-subtle">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground-muted">{title}</p>
      <p className="mt-1 max-w-[200px] text-xs text-foreground-subtle">{hint}</p>
    </div>
  );
}
