import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A collapsible control group (Layout, Spacing, …). */
export function StyleGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-surface-sunken"
      >
        <span className="text-2xs font-semibold uppercase tracking-wider text-foreground-muted">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-foreground-subtle transition-transform duration-150',
            !open && '-rotate-90',
          )}
        />
      </button>
      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </section>
  );
}
