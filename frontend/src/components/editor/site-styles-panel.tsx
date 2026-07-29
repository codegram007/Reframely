import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ColorToken, TreeNode, TypographyToken } from '@/lib/schema';
import { tokenUsageIndex, type TokenUsage } from '@/lib/token-engine';
import { nodeLabel } from '@/lib/tree-index';
import { useTreeStore } from '@/stores/tree-store';
import { useEditorUiStore } from '@/stores/editor-ui-store';
import { useSelectionStore } from '@/stores/selection-store';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Normalize any CSS color to #rrggbb for the native picker (best-effort). */
function toHexInput(css: string): string {
  if (/^#[0-9a-f]{6}$/i.test(css)) return css;
  if (/^#[0-9a-f]{3}$/i.test(css)) {
    return '#' + css.slice(1).split('').map((c) => c + c).join('');
  }
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

function nextColorId(existing: ColorToken[]): string {
  let n = existing.length + 1;
  let id = `color-${n}`;
  const ids = new Set(existing.map((c) => c.id));
  while (ids.has(id)) {
    n += 1;
    id = `color-${n}`;
  }
  return id;
}

/**
 * Site Styles — the global design-tokens panel (F12). A separate surface
 * from per-widget settings: it edits `tree.tokens` (the site-wide color
 * palette + typography scale), shows how many widgets reference each token,
 * and — because codegen emits token refs as CSS vars — an edit here
 * propagates to every referencing widget in a single mutation. This is the
 * PRD's "change the accent color across the site" without the AI assistant.
 */
export function SiteStylesPanel() {
  const open = useEditorUiStore((s) => s.siteStylesOpen);
  const setOpen = useEditorUiStore((s) => s.setSiteStylesOpen);
  const tree = useTreeStore((s) => s.tree);
  const addColorToken = useTreeStore((s) => s.addColorToken);

  const usage = useMemo(() => tokenUsageIndex(tree), [tree]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Site Styles"
      description="Global colors and typography. Edits apply everywhere the token is used."
      className="max-w-xl"
    >
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Colors
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                addColorToken({
                  id: nextColorId(tree.tokens.colors),
                  name: 'New color',
                  value: '#888888',
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add color
            </Button>
          </div>
          {tree.tokens.colors.length === 0 ? (
            <EmptyRow text="No color tokens detected." />
          ) : (
            <div className="flex flex-col gap-2">
              {tree.tokens.colors.map((token) => (
                <ColorTokenRow
                  key={token.id}
                  token={token}
                  usage={usage[token.id] ?? { count: 0, nodes: [] }}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Typography
          </h3>
          {tree.tokens.typography.length === 0 ? (
            <EmptyRow text="No typography tokens detected." />
          ) : (
            <div className="flex flex-col gap-2">
              {tree.tokens.typography.map((token) => (
                <TypographyTokenRow
                  key={token.id}
                  token={token}
                  usage={usage[token.id] ?? { count: 0, nodes: [] }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface-sunken px-3 py-4 text-center text-xs text-foreground-subtle">
      {text}
    </div>
  );
}

function ColorTokenRow({ token, usage }: { token: ColorToken; usage: TokenUsage }) {
  const setValue = useTreeStore((s) => s.setColorTokenValue);
  const previewValue = useTreeStore((s) => s.previewColorTokenValue);
  const setName = useTreeStore((s) => s.setColorTokenName);
  const removeColorToken = useTreeStore((s) => s.removeColorToken);
  const beginSession = useTreeStore((s) => s.beginStyleSession);
  const commitSession = useTreeStore((s) => s.commitStyleSession);

  const [name, setLocalName] = useState(token.name);
  const [hex, setHex] = useState(token.value);

  // Resync local fields when the token changes from outside this row
  // (undo/redo, or another edit). Guarded by identity so typing isn't
  // clobbered mid-edit.
  useEffect(() => {
    setLocalName(token.name);
  }, [token.name]);
  useEffect(() => {
    setHex(token.value);
  }, [token.value]);

  return (
    <div className="rounded-md border border-border bg-surface p-2.5">
      <div className="flex items-center gap-2.5">
        {/* Swatch + native picker (drag = one undo step via style session) */}
        <label
          className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
          style={{ backgroundColor: token.value }}
          title="Pick color"
        >
          <input
            type="color"
            value={toHexInput(token.value)}
            onFocus={beginSession}
            onChange={(e) => {
              setHex(e.target.value);
              previewValue(token.id, e.target.value);
            }}
            onBlur={commitSession}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            type="text"
            aria-label="Token name"
            value={name}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => setName(token.id, name.trim() || token.name)}
            className="h-7 w-full rounded border border-border bg-surface-sunken px-2 text-xs font-medium text-foreground focus-visible:border-accent focus-visible:outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Token value"
              value={hex}
              spellCheck={false}
              onChange={(e) => {
                setHex(e.target.value);
                previewValue(token.id, e.target.value);
              }}
              onBlur={() => setValue(token.id, hex.trim() || token.value)}
              className="h-7 min-w-0 flex-1 rounded border border-border bg-surface-sunken px-2 font-mono text-xs text-foreground focus-visible:border-accent focus-visible:outline-none"
            />
            <code className="shrink-0 text-2xs text-foreground-subtle">--{token.id}</code>
          </div>
        </div>

        <button
          type="button"
          title={usage.count > 0 ? 'Remove token (keeps current color on widgets)' : 'Remove token'}
          onClick={() => removeColorToken(token.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-foreground-subtle hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <UsageLine usage={usage} />
    </div>
  );
}

function TypographyTokenRow({ token, usage }: { token: TypographyToken; usage: TokenUsage }) {
  const setTypographyToken = useTreeStore((s) => s.setTypographyToken);
  const [family, setFamily] = useState(token.fontFamily);
  const [size, setSize] = useState(token.fontSize);
  const [weight, setWeight] = useState(String(token.fontWeight));

  useEffect(() => setFamily(token.fontFamily), [token.fontFamily]);
  useEffect(() => setSize(token.fontSize), [token.fontSize]);
  useEffect(() => setWeight(String(token.fontWeight)), [token.fontWeight]);

  return (
    <div className="rounded-md border border-border bg-surface p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{token.name}</span>
        <code className="text-2xs text-foreground-subtle">--{token.id}</code>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="text"
          aria-label="Font family"
          value={family}
          onChange={(e) => setFamily(e.target.value)}
          onBlur={() => setTypographyToken(token.id, { fontFamily: family.trim() || token.fontFamily })}
          className="h-7 min-w-0 rounded border border-border bg-surface-sunken px-2 text-xs text-foreground focus-visible:border-accent focus-visible:outline-none"
        />
        <input
          type="text"
          aria-label="Font size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          onBlur={() => setTypographyToken(token.id, { fontSize: size.trim() || token.fontSize })}
          className="h-7 w-16 rounded border border-border bg-surface-sunken px-2 font-mono text-xs text-foreground focus-visible:border-accent focus-visible:outline-none"
        />
        <input
          type="number"
          aria-label="Font weight"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => {
            const n = Number(weight);
            if (Number.isFinite(n) && n > 0) setTypographyToken(token.id, { fontWeight: n });
            else setWeight(String(token.fontWeight));
          }}
          className="h-7 w-16 rounded border border-border bg-surface-sunken px-2 font-mono text-xs text-foreground focus-visible:border-accent focus-visible:outline-none"
        />
      </div>
      <UsageLine usage={usage} />
    </div>
  );
}

function UsageLine({ usage }: { usage: TokenUsage }) {
  const setSelected = useSelectionStore((s) => s.setSelected);
  const setOpen = useEditorUiStore((s) => s.setSiteStylesOpen);

  if (usage.count === 0) {
    return <p className="mt-2 text-2xs text-foreground-subtle">Not used by any widget.</p>;
  }

  const preview = usage.nodes.slice(0, 4);
  const jumpTo = (node: TreeNode) => {
    setSelected(node.id);
    setOpen(false);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-2xs text-foreground-muted">
        Used by {usage.count} {usage.count === 1 ? 'widget' : 'widgets'}:
      </span>
      {preview.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => jumpTo(node)}
          className={cn(
            'rounded bg-surface-sunken px-1.5 py-0.5 text-2xs text-foreground-muted',
            'hover:bg-accent-subtle hover:text-accent',
          )}
        >
          {nodeLabel(node)}
        </button>
      ))}
      {usage.count > preview.length && (
        <span className="text-2xs text-foreground-subtle">+{usage.count - preview.length} more</span>
      )}
    </div>
  );
}
