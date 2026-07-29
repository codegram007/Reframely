import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { ColorToken, StyleValue } from '@/lib/schema';
import { cn } from '@/lib/utils';

/** Resolve a StyleValue color to a CSS color string for display. */
function resolveColor(value: StyleValue | undefined, tokens: ColorToken[]): string | null {
  if (value === undefined) return null;
  if (typeof value === 'object' && value.type === 'token') {
    return tokens.find((t) => t.id === value.tokenId)?.value ?? null;
  }
  if (typeof value === 'string') return value;
  return null;
}

/** Normalize any CSS color to #rrggbb for the native picker (best-effort). */
function toHexInput(css: string | null): string {
  if (!css) return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(css)) return css;
  if (/^#[0-9a-f]{3}$/i.test(css)) {
    return '#' + css.slice(1).split('').map((c) => c + c).join('');
  }
  // rgb()/named colors: let a canvas resolve it.
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.fillStyle = css;
      const resolved = ctx.fillStyle;
      if (/^#[0-9a-f]{6}$/i.test(resolved)) return resolved;
    }
  } catch {
    /* ignore */
  }
  return '#000000';
}

/**
 * Color control: token swatches (from global tokens), a native color
 * picker, and a hex text field. Selecting a token stores a token
 * reference so the value participates in global theming.
 */
export function ColorControl({
  value,
  tokens,
  onCommit,
  onPreview,
  onSessionStart,
  onSessionEnd,
}: {
  value: StyleValue | undefined;
  tokens: ColorToken[];
  onCommit: (value: StyleValue | undefined) => void;
  onPreview?: (value: StyleValue | undefined) => void;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}) {
  const resolved = useMemo(() => resolveColor(value, tokens), [value, tokens]);
  const activeTokenId =
    value && typeof value === 'object' && value.type === 'token' ? value.tokenId : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {/* Swatch preview + native picker */}
        <label
          className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
          style={{
            backgroundColor: resolved ?? undefined,
            backgroundImage: resolved
              ? undefined
              : 'linear-gradient(45deg,hsl(var(--border)) 25%,transparent 25%,transparent 75%,hsl(var(--border)) 75%)',
            backgroundSize: '8px 8px',
          }}
        >
          <input
            type="color"
            value={toHexInput(resolved)}
            onFocus={onSessionStart}
            onChange={(e) => onPreview?.(e.target.value)}
            onBlur={(e) => {
              onCommit(e.target.value);
              onSessionEnd?.();
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        {/* Hex text input */}
        <input
          type="text"
          value={typeof value === 'string' ? value : (resolved ?? '')}
          placeholder="—"
          spellCheck={false}
          onChange={(e) => onPreview?.(e.target.value || undefined)}
          onBlur={(e) => onCommit(e.target.value.trim() || undefined)}
          className={cn(
            'h-7 min-w-0 flex-1 rounded-md border border-border bg-surface-sunken px-2 font-mono text-xs text-foreground',
            'placeholder:text-foreground-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          )}
        />

        {value !== undefined && (
          <button
            type="button"
            title="Clear"
            onClick={() => onCommit(undefined)}
            className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-foreground-subtle hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Token swatches */}
      {tokens.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tokens.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.name}
              onClick={() => onCommit({ type: 'token', tokenId: t.id })}
              className={cn(
                'h-5 w-5 rounded border transition-transform hover:scale-110',
                activeTokenId === t.id ? 'border-accent ring-1 ring-accent' : 'border-border',
              )}
              style={{ backgroundColor: t.value }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
