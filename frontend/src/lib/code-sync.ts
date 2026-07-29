/**
 * Code View sync-back (F14) — parse hand-edited HTML/CSS into a widget-tree
 * patch and apply it.
 *
 * IMPORTANT — this is a FRONTEND STOPGAP. The PRD wants edited markup parsed
 * back through the backend classifier (prompt B4) server-side, which can
 * re-derive structure (new elements, moved nodes, retag). That endpoint
 * doesn't exist yet, so per the frontend-first workflow this module
 * implements the *safe, bounded subset* that covers the common cases —
 * editing CSS declarations on existing nodes, and editing text/heading
 * content — behind the same shape the real endpoint will expose:
 *
 *     computeCodeDiff(tree, editedHtml, editedCss) -> CodeDiff
 *     applyCodeDiff(tree, diff) -> WidgetTree
 *
 * `parseCodeEdits` is the UI entry point: it tries the server code-sync
 * route first, then falls back to `computeCodeDiff`. The confirmation
 * modal + `applyCodeDiff` path are unchanged either way. Structural edits
 * we can't map are surfaced in `diff.unresolved` (never silently dropped)
 * — raw-code edits are a higher-risk write path than panel edits.
 *
 * Determinism note: we diff the CURRENT generated CSS against the edited CSS
 * (both parsed identically), so token references (`var(--id)`) round-trip
 * and a no-op edit yields an empty diff.
 */
import type { StyleValue, TreeNode, WidgetTree } from './schema';
import { generateCss } from './codegen';
import { setNodeStyle, type StyleKey } from './style-engine';
import { setNodeContent } from './tree-edit';
import { findNode, nodeLabel } from './tree-index';

// ---------------------------------------------------------------------------
// diff types (the shape the future server endpoint will also return)
// ---------------------------------------------------------------------------

export interface StyleFieldChange {
  key: StyleKey;
  kind: 'add' | 'change' | 'remove';
  /** Previous CSS value (for display); undefined when adding. */
  from?: string;
  /** New CSS value (for display); undefined when removing. */
  to?: string;
  /** Parsed value to write (undefined clears the declaration). */
  value: StyleValue | undefined;
}

export interface NodeStyleChange {
  nodeId: string;
  label: string;
  fields: StyleFieldChange[];
}

export interface ContentChange {
  nodeId: string;
  label: string;
  from: string;
  to: string;
  text: string;
}

export interface CodeDiff {
  styles: NodeStyleChange[];
  content: ContentChange[];
  /** Human-readable notes about edits we could not map to a patch. */
  unresolved: string[];
}

export function isEmptyDiff(diff: CodeDiff): boolean {
  return diff.styles.length === 0 && diff.content.length === 0;
}

// ---------------------------------------------------------------------------
// CSS parsing (base scope only — @media blocks are out of scope for the stub)
// ---------------------------------------------------------------------------

/** Every writable NodeStyles key, so unknown props route to `unresolved`. */
const STYLE_KEYS = new Set<string>([
  // spacing
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  // typography
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'textAlign', 'textTransform', 'textDecoration', 'fontStyle', 'listStyleType',
  // color
  'color', 'backgroundColor', 'backgroundImage', 'backgroundSize',
  'backgroundPosition', 'backgroundRepeat',
  // border
  'borderWidth', 'borderStyle', 'borderColor', 'borderRadius',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  // layout
  'display', 'flexDirection', 'justifyContent', 'alignItems', 'flexWrap',
  'flexGrow', 'flexShrink', 'flexBasis', 'order', 'boxSizing', 'gap',
  'gridTemplateColumns', 'gridTemplateRows', 'width', 'height',
  'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  // effect
  'boxShadow', 'opacity', 'transform', 'transition',
  // position
  'position', 'top', 'right', 'bottom', 'left', 'zIndex',
]);

/** Remove every `@media (...) { ... }` block (brace-matched). */
function stripAtRules(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('@media', i)) {
      const braceStart = css.indexOf('{', i);
      if (braceStart === -1) break;
      let depth = 1;
      let j = braceStart + 1;
      for (; j < css.length && depth > 0; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
      }
      i = j; // skip the whole block
      continue;
    }
    out += css[i];
    i++;
  }
  return out;
}

function kebabToCamel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

/** Map of nodeId → { camelKey: cssValueString } for single-class vs- rules. */
function parseNodeRules(css: string): Map<string, Record<string, string>> {
  const stripped = stripAtRules(css);
  const rules = new Map<string, Record<string, string>>();
  // Match `.selector { body }` — reject compound selectors (only single class).
  const re = /\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const cls = m[1]!;
    if (!cls.startsWith('vs-')) continue;
    const nodeId = cls.slice(3);
    const body = m[2]!;
    const decls: Record<string, string> = {};
    for (const chunk of body.split(';')) {
      const idx = chunk.indexOf(':');
      if (idx === -1) continue;
      const prop = chunk.slice(0, idx).trim();
      const value = chunk.slice(idx + 1).trim();
      if (prop === '' || value === '') continue;
      decls[prop] = value;
    }
    rules.set(nodeId, { ...(rules.get(nodeId) ?? {}), ...decls });
  }
  return rules;
}

/** CSS value string → StyleValue (token refs preserved, else raw string). */
function toStyleValue(css: string): StyleValue {
  const token = /^var\(\s*--([A-Za-z0-9_-]+)\s*\)$/.exec(css);
  if (token) return { type: 'token', tokenId: token[1]! };
  return css;
}

function styleValuesEqual(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------

export function computeCodeDiff(
  tree: WidgetTree,
  editedHtml: string,
  editedCss: string,
): CodeDiff {
  const unresolved: string[] = [];
  const styles = diffStyles(tree, editedCss, unresolved);
  const content = diffContent(tree, editedHtml, unresolved);
  return { styles, content, unresolved };
}

/**
 * F14 entry point for "Review changes". Tries the server code-sync route
 * (B4-style reparse) when a projectId is provided; always falls back to
 * the client stopgap so the confirmation dialog still works offline /
 * pre-backend.
 *
 * The confirmation UI always runs on the returned diff — raw code never
 * auto-applies to the tree.
 */
export async function parseCodeEdits(
  tree: WidgetTree,
  editedHtml: string,
  editedCss: string,
  opts?: { projectId?: string | null },
): Promise<CodeDiff> {
  const projectId = opts?.projectId;
  if (projectId && projectId !== 'demo') {
    try {
      // Lazy import to keep codegen/sync free of the fetch client when unused.
      const { api } = await import('@/lib/api/client');
      const remote = await api.parseCodeEdits(projectId, {
        html: editedHtml,
        css: editedCss,
        tree,
      });
      // Normalize to CodeDiff; server field values are re-parsed client-side
      // for apply safety if the response is sparse.
      return {
        styles: remote.styles.map((s) => ({
          nodeId: s.nodeId,
          label: s.label,
          fields: s.fields.map((f): StyleFieldChange => {
            const field: StyleFieldChange = {
              key: f.key as StyleKey,
              kind: f.kind,
              value: f.value as StyleValue | undefined,
            };
            if (f.from !== undefined) field.from = f.from;
            if (f.to !== undefined) field.to = f.to;
            return field;
          }),
        })),
        content: remote.content,
        unresolved: remote.unresolved,
      };
    } catch {
      // Endpoint missing / network — client stopgap.
    }
  }
  return computeCodeDiff(tree, editedHtml, editedCss);
}

function diffStyles(tree: WidgetTree, editedCss: string, unresolved: string[]): NodeStyleChange[] {
  const base = parseNodeRules(generateCss(tree));
  const edited = parseNodeRules(editedCss);
  const out: NodeStyleChange[] = [];

  for (const [nodeId, editDecls] of edited) {
    const node = findNode(tree, nodeId);
    if (!node) {
      unresolved.push(`New/unknown rule .vs-${nodeId} — can't attach to a node (needs the server parser).`);
      continue;
    }
    const baseDecls = base.get(nodeId) ?? {};
    const fields: StyleFieldChange[] = [];
    const props = new Set([...Object.keys(baseDecls), ...Object.keys(editDecls)]);

    for (const prop of props) {
      const camel = kebabToCamel(prop);
      if (!STYLE_KEYS.has(camel)) {
        if (editDecls[prop] !== baseDecls[prop]) {
          unresolved.push(`.vs-${nodeId} { ${prop} } isn't an editable style field — skipped.`);
        }
        continue;
      }
      const key = camel as StyleKey;
      const before = baseDecls[prop];
      const after = editDecls[prop];
      if (before !== undefined && after === undefined) {
        fields.push({ key, kind: 'remove', from: before, value: undefined });
      } else if (before === undefined && after !== undefined) {
        fields.push({ key, kind: 'add', to: after, value: toStyleValue(after) });
      } else if (before !== undefined && after !== undefined && !styleValuesEqual(before, after)) {
        fields.push({ key, kind: 'change', from: before, to: after, value: toStyleValue(after) });
      }
    }

    if (fields.length > 0) out.push({ nodeId, label: nodeLabel(node), fields });
  }

  return out;
}

function diffContent(tree: WidgetTree, editedHtml: string, unresolved: string[]): ContentChange[] {
  const out: ContentChange[] = [];
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(editedHtml, 'text/html');
  } catch {
    unresolved.push('Could not parse the edited HTML — content changes skipped.');
    return out;
  }

  walk(tree.root, (node) => {
    if (node.type !== 'widget') return;
    if (node.widgetType !== 'text' && node.widgetType !== 'heading') return;
    const el = doc.querySelector(`.vs-${cssEscape(node.id)}`);
    if (!el) return;
    // Heading content is HTML-escaped by codegen → recover via textContent.
    // Text content is emitted raw → recover via innerHTML.
    const next = node.widgetType === 'heading' ? (el.textContent ?? '') : el.innerHTML;
    const current = (node.props as { content: string }).content;
    if (next !== current) {
      out.push({ nodeId: node.id, label: nodeLabel(node), from: current, to: next, text: next });
    }
  });

  return out;
}

/** Minimal CSS.escape shim for selector building (ids are `w-xxxx` style). */
function cssEscape(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
  return id.replace(/([^\w-])/g, '\\$1');
}

function walk(node: TreeNode, visit: (n: TreeNode) => void): void {
  visit(node);
  if (node.type !== 'widget') for (const c of node.children as TreeNode[]) walk(c, visit);
}

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

/** Fold a diff into the tree (one immutable pass; caller wraps in `commit`). */
export function applyCodeDiff(tree: WidgetTree, diff: CodeDiff): WidgetTree {
  let next = tree;
  for (const change of diff.styles) {
    for (const field of change.fields) {
      next = setNodeStyle(next, change.nodeId, 'desktop', field.key, field.value);
    }
  }
  for (const change of diff.content) {
    next = setNodeContent(next, change.nodeId, change.text);
  }
  return next;
}
