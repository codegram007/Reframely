import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalSpaceBetween,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  StretchVertical,
  MoveHorizontal,
  MoveVertical,
} from 'lucide-react';
import type { Breakpoint, ColorToken, StyleValue, TreeNode } from '@/lib/schema';
import { StyleGroup } from './style-group';
import { Field, NumberInput, SegmentedControl, Select, parsePx } from './controls';
import { ColorControl } from './color-control';
import { useNodeStyles } from './use-node-styles';

interface GroupProps {
  node: TreeNode;
  breakpoint: Breakpoint;
  tokens: ColorToken[];
}

// Structural nodes get the Layout group.
const LAYOUT_NODE_TYPES = new Set(['section', 'row', 'column', 'page']);

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function LayoutGroup({ node, breakpoint }: GroupProps) {
  const { field, beginStyleSession, commitStyleSession } = useNodeStyles(node, breakpoint);
  if (!LAYOUT_NODE_TYPES.has(node.type)) return null;

  const display = field('display');
  const direction = field('flexDirection');
  const justify = field('justifyContent');
  const align = field('alignItems');
  const gap = field('gap');
  const isFlex = display.value === 'flex';

  return (
    <StyleGroup title="Layout">
      <Field label="Display" overridden={display.overridden} inherited={display.inherited} onRevert={() => display.set(undefined)}>
        <SegmentedControl
          value={(display.value as string) ?? 'block'}
          onChange={(v) => display.set(v as typeof display.value)}
          options={[
            { value: 'block', label: 'Block' },
            { value: 'flex', label: 'Flex' },
            { value: 'grid', label: 'Grid' },
          ]}
        />
      </Field>

      {isFlex && (
        <>
          <Field label="Direction" overridden={direction.overridden} inherited={direction.inherited} onRevert={() => direction.set(undefined)}>
            <SegmentedControl
              value={(direction.value as string) ?? 'row'}
              onChange={(v) => direction.set(v as typeof direction.value)}
              options={[
                { value: 'row', icon: <MoveHorizontal className="h-3.5 w-3.5" />, title: 'Row' },
                { value: 'column', icon: <MoveVertical className="h-3.5 w-3.5" />, title: 'Column' },
              ]}
            />
          </Field>
          <Field label="Justify" overridden={justify.overridden} inherited={justify.inherited} onRevert={() => justify.set(undefined)}>
            <SegmentedControl
              value={(justify.value as string) ?? 'flex-start'}
              onChange={(v) => justify.set(v as typeof justify.value)}
              options={[
                { value: 'flex-start', icon: <AlignHorizontalJustifyStart className="h-3.5 w-3.5" />, title: 'Start' },
                { value: 'center', icon: <AlignHorizontalJustifyCenter className="h-3.5 w-3.5" />, title: 'Center' },
                { value: 'flex-end', icon: <AlignHorizontalJustifyEnd className="h-3.5 w-3.5" />, title: 'End' },
                { value: 'space-between', icon: <AlignHorizontalSpaceBetween className="h-3.5 w-3.5" />, title: 'Space between' },
              ]}
            />
          </Field>
          <Field label="Align" overridden={align.overridden} inherited={align.inherited} onRevert={() => align.set(undefined)}>
            <SegmentedControl
              value={(align.value as string) ?? 'stretch'}
              onChange={(v) => align.set(v as typeof align.value)}
              options={[
                { value: 'flex-start', icon: <AlignStartVertical className="h-3.5 w-3.5" />, title: 'Start' },
                { value: 'center', icon: <AlignCenterVertical className="h-3.5 w-3.5" />, title: 'Center' },
                { value: 'flex-end', icon: <AlignEndVertical className="h-3.5 w-3.5" />, title: 'End' },
                { value: 'stretch', icon: <StretchVertical className="h-3.5 w-3.5" />, title: 'Stretch' },
              ]}
            />
          </Field>
        </>
      )}

      {(isFlex || display.value === 'grid') && (
        <Field label="Gap" overridden={gap.overridden} inherited={gap.inherited} onRevert={() => gap.set(undefined)}>
          <NumberInput
            value={parsePx(gap.value)}
            onCommit={(v) => gap.set(v === undefined ? undefined : v)}
            onPreview={(v) => gap.preview(v === undefined ? undefined : v)}
            onSessionStart={beginStyleSession}
            onSessionEnd={commitStyleSession}
          />
        </Field>
      )}
    </StyleGroup>
  );
}

// ---------------------------------------------------------------------------
// Spacing (visual box-model)
// ---------------------------------------------------------------------------

export function SpacingGroup({ node, breakpoint }: GroupProps) {
  const { field, beginStyleSession, commitStyleSession } = useNodeStyles(node, breakpoint);
  const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;

  const boxInput = (kind: 'margin' | 'padding', side: (typeof sides)[number]) => {
    const key = `${kind}${side}` as
      | 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft'
      | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft';
    const f = field(key);
    return (
      <input
        key={key}
        type="number"
        aria-label={`${kind} ${side}`}
        title={`${kind} ${side}${f.overridden ? ' (overridden)' : f.inherited ? ' (inherited)' : ''}`}
        defaultValue={parsePx(f.value) ?? ''}
        placeholder="0"
        onFocus={beginStyleSession}
        onChange={(e) => f.preview(e.target.value === '' ? undefined : Number(e.target.value))}
        onBlur={(e) => {
          f.set(e.target.value === '' ? undefined : Number(e.target.value));
          commitStyleSession();
        }}
        className={`h-6 w-11 rounded border bg-surface px-1 text-center text-2xs text-foreground [appearance:textfield] focus-visible:border-accent focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none ${
          f.overridden ? 'border-accent' : 'border-border'
        }`}
      />
    );
  };

  return (
    <StyleGroup title="Spacing">
      {/* Margin box wrapping a padding box, Elementor-style. */}
      <div className="rounded-lg border border-dashed border-border-strong bg-surface-sunken p-1.5">
        <div className="mb-1 text-2xs uppercase tracking-wide text-foreground-subtle">Margin</div>
        <div className="flex items-center justify-between">{boxInput('margin', 'Top')}</div>
        <div className="my-1 flex items-center justify-between gap-1">
          {boxInput('margin', 'Left')}
          <div className="flex-1 rounded-md border border-border bg-surface p-1.5">
            <div className="mb-1 text-center text-2xs uppercase tracking-wide text-foreground-subtle">Padding</div>
            <div className="flex justify-center">{boxInput('padding', 'Top')}</div>
            <div className="my-1 flex items-center justify-between gap-1">
              {boxInput('padding', 'Left')}
              <div className="h-6 flex-1 rounded bg-surface-sunken" />
              {boxInput('padding', 'Right')}
            </div>
            <div className="flex justify-center">{boxInput('padding', 'Bottom')}</div>
          </div>
          {boxInput('margin', 'Right')}
        </div>
        <div className="flex items-center justify-between">{boxInput('margin', 'Bottom')}</div>
      </div>
    </StyleGroup>
  );
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

const FONT_STACKS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter (Sans)' },
  { value: 'Georgia, serif', label: 'Georgia (Serif)' },
  { value: '"Times New Roman", serif', label: 'Times (Serif)' },
  { value: 'Arial, sans-serif', label: 'Arial (Sans)' },
  { value: '"JetBrains Mono", monospace', label: 'Mono' },
];

const WEIGHTS = [
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
];

export function TypographyGroup({ node, breakpoint, tokens }: GroupProps) {
  const { field, beginStyleSession, commitStyleSession } = useNodeStyles(node, breakpoint);
  const fontFamily = field('fontFamily');
  const fontSize = field('fontSize');
  const fontWeight = field('fontWeight');
  const lineHeight = field('lineHeight');
  const letterSpacing = field('letterSpacing');
  const color = field('color');

  return (
    <StyleGroup title="Typography">
      <Field label="Font" overridden={fontFamily.overridden} inherited={fontFamily.inherited} onRevert={() => fontFamily.set(undefined)}>
        <Select
          value={typeof fontFamily.value === 'string' ? fontFamily.value : undefined}
          onChange={(v) => fontFamily.set(v)}
          options={FONT_STACKS}
          placeholder="Default"
        />
      </Field>
      <Field label="Size" overridden={fontSize.overridden} inherited={fontSize.inherited} onRevert={() => fontSize.set(undefined)}>
        <NumberInput
          value={parsePx(fontSize.value)}
          onCommit={(v) => fontSize.set(v)}
          onPreview={(v) => fontSize.preview(v)}
          onSessionStart={beginStyleSession}
          onSessionEnd={commitStyleSession}
        />
      </Field>
      <Field label="Weight" overridden={fontWeight.overridden} inherited={fontWeight.inherited} onRevert={() => fontWeight.set(undefined)}>
        <Select
          value={fontWeight.value !== undefined ? String(fontWeight.value) : undefined}
          onChange={(v) => fontWeight.set(v === undefined ? undefined : Number(v))}
          options={WEIGHTS}
          placeholder="Default"
        />
      </Field>
      <Field label="Line height" overridden={lineHeight.overridden} inherited={lineHeight.inherited} onRevert={() => lineHeight.set(undefined)}>
        <NumberInput
          value={parsePx(lineHeight.value)}
          unit="px"
          onCommit={(v) => lineHeight.set(v)}
          onPreview={(v) => lineHeight.preview(v)}
          onSessionStart={beginStyleSession}
          onSessionEnd={commitStyleSession}
        />
      </Field>
      <Field label="Letter sp." overridden={letterSpacing.overridden} inherited={letterSpacing.inherited} onRevert={() => letterSpacing.set(undefined)}>
        <NumberInput
          value={parsePx(letterSpacing.value)}
          onCommit={(v) => letterSpacing.set(v)}
          onPreview={(v) => letterSpacing.preview(v)}
          onSessionStart={beginStyleSession}
          onSessionEnd={commitStyleSession}
        />
      </Field>
      <Field label="Color" overridden={color.overridden} inherited={color.inherited} onRevert={() => color.set(undefined)}>
        <ColorControl
          value={color.value as StyleValue | undefined}
          tokens={tokens}
          onCommit={(v) => color.set(v)}
          onPreview={(v) => color.preview(v)}
          onSessionStart={beginStyleSession}
          onSessionEnd={commitStyleSession}
        />
      </Field>
    </StyleGroup>
  );
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

export function BackgroundGroup({ node, breakpoint, tokens }: GroupProps) {
  const { field, beginStyleSession, commitStyleSession } = useNodeStyles(node, breakpoint);
  const bg = field('backgroundColor');
  const bgImage = field('backgroundImage');

  return (
    <StyleGroup title="Background">
      <Field label="Color" overridden={bg.overridden} inherited={bg.inherited} onRevert={() => bg.set(undefined)}>
        <ColorControl
          value={bg.value as StyleValue | undefined}
          tokens={tokens}
          onCommit={(v) => bg.set(v)}
          onPreview={(v) => bg.preview(v)}
          onSessionStart={beginStyleSession}
          onSessionEnd={commitStyleSession}
        />
      </Field>
      <Field label="Image URL" overridden={bgImage.overridden} inherited={bgImage.inherited} onRevert={() => bgImage.set(undefined)}>
        <input
          type="text"
          defaultValue={
            typeof bgImage.value === 'string' ? bgImage.value.replace(/^url\(["']?|["']?\)$/g, '') : ''
          }
          key={String(bgImage.value)}
          placeholder="https://…"
          spellCheck={false}
          onBlur={(e) => {
            const v = e.target.value.trim();
            bgImage.set(v ? `url("${v}")` : undefined);
          }}
          className="h-7 w-full rounded-md border border-border bg-surface-sunken px-2 text-xs text-foreground placeholder:text-foreground-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </Field>
      <p className="pt-1 text-2xs text-foreground-subtle">
        Gradients: paste a <code className="font-mono">linear-gradient(…)</code> into Image URL.
      </p>
    </StyleGroup>
  );
}

// ---------------------------------------------------------------------------
// Border
// ---------------------------------------------------------------------------

const BORDER_STYLES = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

export function BorderGroup({ node, breakpoint, tokens }: GroupProps) {
  const { field, beginStyleSession, commitStyleSession } = useNodeStyles(node, breakpoint);
  const width = field('borderWidth');
  const style = field('borderStyle');
  const color = field('borderColor');
  const radius = field('borderRadius');

  return (
    <StyleGroup title="Border" defaultOpen={false}>
      <Field label="Width" overridden={width.overridden} inherited={width.inherited} onRevert={() => width.set(undefined)}>
        <NumberInput
          value={parsePx(width.value)}
          onCommit={(v) => width.set(v)}
          onPreview={(v) => width.preview(v)}
          onSessionStart={beginStyleSession}
          onSessionEnd={commitStyleSession}
        />
      </Field>
      <Field label="Style" overridden={style.overridden} inherited={style.inherited} onRevert={() => style.set(undefined)}>
        <Select
          value={style.value as string | undefined}
          onChange={(v) => style.set(v as typeof style.value)}
          options={BORDER_STYLES}
          placeholder="None"
        />
      </Field>
      <Field label="Color" overridden={color.overridden} inherited={color.inherited} onRevert={() => color.set(undefined)}>
        <ColorControl
          value={color.value as StyleValue | undefined}
          tokens={tokens}
          onCommit={(v) => color.set(v)}
          onPreview={(v) => color.preview(v)}
          onSessionStart={beginStyleSession}
          onSessionEnd={commitStyleSession}
        />
      </Field>
      <Field label="Radius" overridden={radius.overridden} inherited={radius.inherited} onRevert={() => radius.set(undefined)}>
        <NumberInput
          value={parsePx(radius.value)}
          onCommit={(v) => radius.set(v)}
          onPreview={(v) => radius.preview(v)}
          onSessionStart={beginStyleSession}
          onSessionEnd={commitStyleSession}
        />
      </Field>
    </StyleGroup>
  );
}

// ---------------------------------------------------------------------------
// Shadow (box-shadow builder)
// ---------------------------------------------------------------------------

interface ShadowParts {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

function parseShadow(value: unknown): ShadowParts | null {
  if (typeof value !== 'string' || value === 'none' || value.trim() === '') return null;
  // Extract the color (rgb/hsl/hex) then the four numeric offsets.
  const colorMatch = value.match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))/i);
  const color = colorMatch ? colorMatch[0] : 'rgba(0,0,0,0.2)';
  const nums = (colorMatch ? value.replace(colorMatch[0], '') : value)
    .match(/-?\d+(\.\d+)?/g)
    ?.map(Number) ?? [];
  return {
    x: nums[0] ?? 0,
    y: nums[1] ?? 4,
    blur: nums[2] ?? 12,
    spread: nums[3] ?? 0,
    color,
  };
}

function formatShadow(p: ShadowParts): string {
  return `${p.x}px ${p.y}px ${p.blur}px ${p.spread}px ${p.color}`;
}

export function ShadowGroup({ node, breakpoint, tokens }: GroupProps) {
  const { field, beginStyleSession, commitStyleSession } = useNodeStyles(node, breakpoint);
  const shadow = field('boxShadow');
  const parts = parseShadow(shadow.value) ?? { x: 0, y: 4, blur: 12, spread: 0, color: 'rgba(0,0,0,0.2)' };
  const enabled = parseShadow(shadow.value) !== null;

  const update = (patch: Partial<ShadowParts>, commit: boolean) => {
    const next = formatShadow({ ...parts, ...patch });
    if (commit) shadow.set(next);
    else shadow.preview(next);
  };

  return (
    <StyleGroup title="Shadow" defaultOpen={false}>
      <Field label="Enabled">
        <SegmentedControl
          value={enabled ? 'on' : 'off'}
          onChange={(v) => (v === 'on' ? shadow.set(formatShadow(parts)) : shadow.set(undefined))}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
        />
      </Field>
      {enabled && (
        <>
          {(['x', 'y', 'blur', 'spread'] as const).map((k) => (
            <Field key={k} label={k[0]!.toUpperCase() + k.slice(1)}>
              <NumberInput
                value={parts[k]}
                onCommit={(v) => update({ [k]: v ?? 0 }, true)}
                onPreview={(v) => update({ [k]: v ?? 0 }, false)}
                onSessionStart={beginStyleSession}
                onSessionEnd={commitStyleSession}
              />
            </Field>
          ))}
          <Field label="Color">
            <ColorControl
              value={parts.color}
              tokens={tokens}
              onCommit={(v) => update({ color: typeof v === 'string' ? v : parts.color }, true)}
              onPreview={(v) => update({ color: typeof v === 'string' ? v : parts.color }, false)}
              onSessionStart={beginStyleSession}
              onSessionEnd={commitStyleSession}
            />
          </Field>
        </>
      )}
    </StyleGroup>
  );
}
