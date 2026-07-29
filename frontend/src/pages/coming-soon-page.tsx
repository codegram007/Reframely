import type { ReactNode } from 'react';

/** Generic centered placeholder for routes not yet built out. */
export function ComingSoonPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="max-w-sm text-sm text-foreground-muted">
        {children ?? 'This area is coming soon.'}
      </p>
    </div>
  );
}
