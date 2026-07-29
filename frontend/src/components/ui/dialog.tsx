import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './icon-button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | undefined;
  children: ReactNode;
  /** Hide the close button + disable backdrop/esc close (e.g. mid-import). */
  dismissable?: boolean;
  className?: string;
}

/**
 * Minimal accessible modal dialog: backdrop, centered panel, Escape to
 * close, scroll-lock. No dependency on Radix for now — the surface is
 * small and fully controlled.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  dismissable = true,
  className,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
        onClick={dismissable ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border',
          'bg-surface shadow-lg animate-fade-in',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-foreground-muted">{description}</p>}
          </div>
          {dismissable && (
            <IconButton label="Close" variant="ghost" size="sm" onClick={onClose} className="-mr-1 -mt-1">
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
