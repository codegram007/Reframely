import type { ReactNode } from 'react';

/** A labeled block in the Content tab (stacked label + control). */
export function ContentField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </span>
      {children}
      {hint && <span className="text-2xs text-foreground-subtle">{hint}</span>}
    </div>
  );
}
