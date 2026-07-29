import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
  className?: string;
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
};

/**
 * Minimal CSS-only tooltip: shows on hover/focus-within of its trigger.
 * Good enough for the icon rail in F1; can swap for a Radix popover
 * later if collision-aware positioning is needed.
 */
export function Tooltip({ label, side = 'right', children, className }: TooltipProps) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md px-2 py-1',
          'bg-foreground text-surface text-2xs font-medium shadow-md',
          'opacity-0 scale-95 transition-all duration-150 ease-out-expo',
          'group-hover/tt:opacity-100 group-hover/tt:scale-100',
          'group-focus-within/tt:opacity-100 group-focus-within/tt:scale-100',
          sideClasses[side],
        )}
      >
        {label}
      </span>
    </span>
  );
}
