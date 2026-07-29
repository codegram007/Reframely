import { type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A labeled control row. Shows an "overridden at this breakpoint" dot and
 * a revert button when the field has an override; an "inherited" hint
 * when the effective value comes from desktop.
 */
export function Field({
  label,
  overridden,
  inherited,
  onRevert,
  children,
}: {
  label: string;
  overridden?: boolean;
  inherited?: boolean;
  onRevert?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex w-24 shrink-0 items-center gap-1">
        <span
          className={cn(
            'truncate text-xs',
            overridden ? 'font-medium text-foreground' : 'text-foreground-muted',
          )}
        >
          {label}
        </span>
        {overridden && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Overridden at this breakpoint" />
        )}
        {inherited && (
          <span className="text-2xs text-foreground-subtle" title="Inherited from desktop">
            ↑
          </span>
        )}
        {overridden && onRevert && (
          <button
            type="button"
            onClick={onRevert}
            title="Revert to inherited"
            className="text-foreground-subtle hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Parse a CSS length/number to a plain number, or null. */
export function parsePx(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A number input with a unit suffix; commits on blur/Enter, previews on drag. */
export function NumberInput({
  value,
  placeholder,
  unit = 'px',
  min,
  onCommit,
  onPreview,
  onSessionStart,
  onSessionEnd,
}: {
  value: number | null;
  placeholder?: string;
  unit?: string;
  min?: number;
  onCommit: (value: number | undefined) => void;
  onPreview?: (value: number | undefined) => void;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}) {
  return (
    <div className="relative flex items-center">
      <input
        type="number"
        defaultValue={value ?? ''}
        key={value ?? 'empty'}
        placeholder={placeholder ?? 'auto'}
        min={min}
        onFocus={onSessionStart}
        onChange={(e) => {
          const v = e.target.value === '' ? undefined : Number(e.target.value);
          onPreview?.(v);
        }}
        onBlur={(e) => {
          const v = e.target.value === '' ? undefined : Number(e.target.value);
          onCommit(v);
          onSessionEnd?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={cn(
          'h-7 w-full rounded-md border border-border bg-surface-sunken pl-2 pr-7 text-xs text-foreground',
          'placeholder:text-foreground-subtle focus-visible:border-accent focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/40 [appearance:textfield]',
          '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        )}
      />
      <span className="pointer-events-none absolute right-2 text-2xs text-foreground-subtle">{unit}</span>
    </div>
  );
}

/** A compact segmented button group (icon or text options). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: { value: T; label?: string; icon?: ReactNode; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title ?? o.label}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-6 flex-1 items-center justify-center rounded px-1.5 text-2xs font-medium transition-colors',
            value === o.value
              ? 'bg-surface text-foreground shadow-xs'
              : 'text-foreground-muted hover:text-foreground',
          )}
        >
          {o.icon ?? o.label}
        </button>
      ))}
    </div>
  );
}

/** A simple native select styled to match. */
export function Select<T extends string>({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: T | undefined;
  options: { value: T; label: string }[];
  placeholder?: string;
  onChange: (value: T | undefined) => void;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : (e.target.value as T))}
      className={cn(
        'h-7 w-full rounded-md border border-border bg-surface-sunken px-2 text-xs text-foreground',
        'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
      )}
    >
      <option value="">{placeholder ?? '—'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
