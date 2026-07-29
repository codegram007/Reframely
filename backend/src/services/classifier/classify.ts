/**
 * DOM → Widget classifier (pure).
 *
 * `classifySnapshot(snapshot)` turns one PageSnapshot JSON document into
 * a WidgetTree conforming to the schema, applying heuristics in order:
 *
 *   1. Section detection — semantic top-level tags (header/section/
 *      footer/nav/aside/main/article) and top-level blocks with a
 *      visually distinct background or generous vertical spacing.
 *   2. Row/column detection — horizontal flex or multi-track grid
 *      containers with 2+ direct children of roughly similar size
 *      become a row of columns; block-flow children each become a
 *      single-column row.
 *   3. Widget classification for leaf/near-leaf nodes (img → image,
 *      h1-h6 → heading, p/textual → text, button-like a/button →
 *      button, svg/icon-font → icon, ul/ol → list, video → video,
 *      iframe → embed, ...).
 *   4. Everything else (canvas, complex SVG, custom elements, forms,
 *      unrepresentable nesting) → custom-html, preserving markup
 *      verbatim where captured and attaching subtree <script>s as
 *      `behaviors` entries.
 *   5. Every node's meta carries a confidence score and a short
 *      rationale (meta.notes); low-confidence nodes are reported.
 *   6. Per-breakpoint styles come from the snapshot's captured
 *      tablet/mobile computed-style diffs — overrides are emitted only
 *      where values actually changed vs the desktop baseline.
 *
 * No I/O, no randomness by default (deterministic ids + injectable
 * clock) — snapshot JSON in, widget tree JSON out.
 */

import type {
  PageSnapshot,
  ScriptRef,
  SnapshotElement,
} from '../snapshot/types.js';
import type {
  Behavior,
  ColorToken,
  ColumnNode,
  GlobalTokens,
  NodeMeta,
  NodeStyles,
  PageNode,
  ResponsiveStyles,
  RowNode,
  SectionNode,
  StyleValue,
  WidgetNode,
  WidgetProps,
  WidgetTree,
  WidgetType,
} from './schema.js';

// ============================================================================
// Public API
// ============================================================================

export interface ClassifyOptions {
  /** Timestamp used for meta.createdAt/updatedAt. Default: fixed epoch for determinism. */
  now?: string;
  /** Node id generator. Default: deterministic `node-1`, `node-2`, ... */
  idFn?: () => string;
  /** Nodes below this confidence are reported in `lowConfidence`. Default 0.7. */
  lowConfidenceThreshold?: number;
}

export interface ClassificationStats {
  /** Widget leaf nodes produced. */
  totalWidgets: number;
  /** Top-level sections produced (for import/onboarding summaries). */
  sectionCount: number;
  byType: Partial<Record<WidgetType, number>>;
  customHtmlCount: number;
  /** Share of widgets mapped to a specific type (PRD target: > 0.85). */
  cleanMappingRate: number;
}

export interface LowConfidenceEntry {
  nodeId: string;
  nodeType: string;
  widgetType?: WidgetType;
  confidence: number;
  rationale: string;
  selector?: string;
}

export interface ClassifiedPage {
  tree: WidgetTree;
  stats: ClassificationStats;
  lowConfidence: LowConfidenceEntry[];
}

export function classifySnapshot(
  snapshot: PageSnapshot,
  options: ClassifyOptions = {},
): ClassifiedPage {
  let seq = 0;
  const ctx: Ctx = {
    snapshot,
    idFn: options.idFn ?? (() => `node-${++seq}`),
    now: options.now ?? '1970-01-01T00:00:00.000Z',
    claimedScripts: new Set(),
    maxIndexMemo: new Map(),
  };

  const body = snapshot.dom.children.find((c) => c.tag === 'body');
  if (!body) throw new Error('Snapshot DOM has no <body> element.');

  const sections = sectionsFrom(body, ctx);

  // Scripts not claimed by any widget stay on the page node so no
  // behavior source is lost.
  const pageBehaviors = snapshot.scripts
    .filter((s) => !ctx.claimedScripts.has(s))
    .map((s) => behaviorFrom(s, ctx));

  const page: PageNode = {
    id: ctx.idFn(),
    type: 'page',
    title: snapshot.title,
    styles: responsiveFor(body, ctx),
    meta: meta(ctx, body, 1, 'document body'),
    children: sections,
    ...(pageBehaviors.length > 0 ? { behaviors: pageBehaviors } : {}),
  };

  const tree: WidgetTree = {
    schemaVersion: 1,
    tokens: extractColorTokens(page),
    root: page,
  };

  return {
    tree,
    stats: computeStats(page),
    lowConfidence: collectLowConfidence(page, options.lowConfidenceThreshold ?? 0.7),
  };
}

// ============================================================================
// Internal context & meta helpers
// ============================================================================

interface Ctx {
  snapshot: PageSnapshot;
  idFn: () => string;
  now: string;
  claimedScripts: Set<ScriptRef>;
  maxIndexMemo: Map<SnapshotElement, number>;
}

function meta(ctx: Ctx, el: SnapshotElement | null, confidence: number, rationale: string): NodeMeta {
  return {
    source: 'imported',
    ...(el
      ? {
          originalElement: {
            tagName: el.tag,
            ...(el.classes.length > 0 ? { className: el.classes.join(' ') } : {}),
            selector: selectorFor(el),
          },
        }
      : {}),
    confidence,
    notes: rationale,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

function selectorFor(el: SnapshotElement): string {
  let s = el.tag;
  if (el.id) s += `#${el.id}`;
  else if (el.classes.length > 0) s += `.${el.classes.slice(0, 3).join('.')}`;
  return s;
}

function maxIndexOf(el: SnapshotElement, ctx: Ctx): number {
  const memoized = ctx.maxIndexMemo.get(el);
  if (memoized !== undefined) return memoized;
  let max = el.index;
  for (const child of el.children) max = Math.max(max, maxIndexOf(child, ctx));
  ctx.maxIndexMemo.set(el, max);
  return max;
}

/** Scripts whose parent element lies inside `el`'s subtree. */
function scriptsIn(el: SnapshotElement, ctx: Ctx): ScriptRef[] {
  const max = maxIndexOf(el, ctx);
  return ctx.snapshot.scripts.filter(
    (s) => s.parentIndex >= el.index && s.parentIndex <= max && !ctx.claimedScripts.has(s),
  );
}

function behaviorFrom(script: ScriptRef, ctx: Ctx): Behavior {
  ctx.claimedScripts.add(script);
  return {
    id: ctx.idFn(),
    type: 'custom',
    ...(script.content !== undefined
      ? { script: script.content }
      : script.src !== undefined
        ? { script: `/* external */ // src: ${script.src}` }
        : {}),
    config: {
      inline: script.inline,
      ...(script.src !== undefined ? { src: script.src } : {}),
      parentPath: script.parentPath,
    },
  };
}

// ============================================================================
// Heuristic 1 — Sections
// ============================================================================

const SECTION_TAGS = new Set(['header', 'footer', 'section', 'nav', 'aside', 'article', 'main']);
const SKIP_TAGS = new Set(['script', 'style', 'link', 'meta', 'title', 'template', 'noscript', 'br']);

function contentChildren(el: SnapshotElement): SnapshotElement[] {
  return el.children.filter((c) => !SKIP_TAGS.has(c.tag) && c.styles['display'] !== 'none');
}

/** Peels single generic wrappers (`#root`, `.page`) off the body. */
function unwrapTopLevel(body: SnapshotElement): SnapshotElement[] {
  let candidates = contentChildren(body);
  let depth = 0;
  while (
    candidates.length === 1 &&
    depth < 4 &&
    candidates[0]!.tag === 'div' &&
    !hasDistinctBackground(candidates[0]!) &&
    contentChildren(candidates[0]!).length > 1
  ) {
    candidates = contentChildren(candidates[0]!);
    depth++;
  }
  return candidates;
}

function hasDistinctBackground(el: SnapshotElement): boolean {
  const bg = el.styles['background-color'] ?? '';
  const image = el.styles['background-image'] ?? 'none';
  return (bg !== '' && bg !== 'rgba(0, 0, 0, 0)') || image !== 'none';
}

function hasGenerousSpacing(el: SnapshotElement): boolean {
  const px = (p: string): number => parseFloat(el.styles[p] ?? '0') || 0;
  return (
    px('padding-top') + px('padding-bottom') >= 48 ||
    px('margin-top') + px('margin-bottom') >= 48
  );
}

function sectionsFrom(body: SnapshotElement, ctx: Ctx): SectionNode[] {
  const sections: SectionNode[] = [];
  for (const el of unwrapTopLevel(body)) {
    let confidence: number;
    let rationale: string;
    if (SECTION_TAGS.has(el.tag)) {
      confidence = 0.95;
      rationale = `semantic <${el.tag}> at top level`;
    } else if (hasDistinctBackground(el)) {
      confidence = 0.8;
      rationale = 'top-level block with distinct background';
    } else if (hasGenerousSpacing(el)) {
      confidence = 0.75;
      rationale = 'top-level block with generous vertical spacing';
    } else if (el.bbox.height >= 200) {
      confidence = 0.65;
      rationale = 'large top-level block without explicit section signals';
    } else {
      confidence = 0.5;
      rationale = 'loose top-level element promoted to section';
    }
    const name = sectionName(el);
    const { rows, layoutOnSectionElement } = rowsFrom(el, ctx);
    // When the section element itself became the row container, the
    // layout props live on the row — keep only box styling here so
    // padding/background are not applied twice in generated output.
    const styles = layoutOnSectionElement
      ? filterStyles(responsiveFor(el, ctx), ROW_LAYOUT_KEYS, 'omit')
      : responsiveFor(el, ctx);
    sections.push({
      id: ctx.idFn(),
      type: 'section',
      ...(name !== undefined ? { name } : {}),
      styles,
      meta: meta(ctx, el, confidence, rationale),
      children: rows,
    });
  }
  return sections;
}

function sectionName(el: SnapshotElement): string | undefined {
  const named: Record<string, string> = {
    header: 'Header', footer: 'Footer', nav: 'Navigation', aside: 'Sidebar', main: 'Main',
  };
  if (named[el.tag]) return named[el.tag];
  const hint = [el.id ?? '', ...el.classes].find((c) => /hero|pricing|features?|about|contact|cta|testimonial|faq|gallery/i.test(c));
  if (hint) return hint.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const heading = findFirst(el, (e) => /^h[1-6]$/.test(e.tag));
  if (heading) {
    const text = collectText(heading);
    if (text) return text.slice(0, 40);
  }
  return undefined;
}

function findFirst(
  el: SnapshotElement,
  pred: (e: SnapshotElement) => boolean,
): SnapshotElement | undefined {
  for (const child of el.children) {
    if (pred(child)) return child;
    const found = findFirst(child, pred);
    if (found) return found;
  }
  return undefined;
}

// ============================================================================
// Heuristic 2 — Rows & Columns
// ============================================================================

function isHorizontalContainer(el: SnapshotElement): boolean {
  const display = el.styles['display'];
  if (display === 'flex' || display === 'inline-flex') {
    const dir = el.styles['flex-direction'] ?? 'row';
    return dir === 'row' || dir === 'row-reverse';
  }
  if (display === 'grid') {
    const tracks = (el.styles['grid-template-columns'] ?? 'none').trim();
    return tracks !== 'none' && tracks.split(/\s+/).length >= 2;
  }
  return false;
}

/** 2+ visible children of roughly similar size sitting on one band. */
function similarSizedChildren(children: SnapshotElement[]): boolean {
  const visible = children.filter((c) => c.bbox.width > 0 && c.bbox.height > 0);
  if (visible.length < 2) return false;
  const widths = visible.map((c) => c.bbox.width);
  const ratio = Math.min(...widths) / Math.max(...widths);
  const tops = visible.map((c) => c.bbox.y);
  return ratio >= 0.2 && Math.max(...tops) - Math.min(...tops) <= 100;
}

/**
 * True when `el` should map to a row-of-columns. Flex rows require the
 * children to sit on one band (`similarSizedChildren`); grids may wrap
 * across multiple rows, so any grid with 2+ similarly-wide visible
 * children qualifies (each child becomes a grid-cell column).
 */
function isColumnLayout(el: SnapshotElement, children: SnapshotElement[]): boolean {
  if (!isHorizontalContainer(el)) return false;
  if (el.styles['display'] === 'grid') {
    const visible = children.filter((c) => c.bbox.width > 0 && c.bbox.height > 0);
    if (visible.length < 2) return false;
    const widths = visible.map((c) => c.bbox.width);
    return Math.min(...widths) / Math.max(...widths) >= 0.2;
  }
  return similarSizedChildren(children);
}

/** Peels single generic wrappers (`.container`) inside a section. */
function unwrapContent(el: SnapshotElement): SnapshotElement {
  let current = el;
  let depth = 0;
  while (depth < 4) {
    const children = contentChildren(current);
    if (
      children.length === 1 &&
      (children[0]!.tag === 'div') &&
      !current.text &&
      !isHorizontalContainer(current)
    ) {
      current = children[0]!;
      depth++;
    } else {
      break;
    }
  }
  return current;
}

interface RowsResult {
  rows: RowNode[];
  /**
   * True when the section's own (possibly unwrapped) element is the
   * horizontal row container — the caller must not also apply the layout
   * props to the section, or spacing/background double up.
   */
  layoutOnSectionElement: boolean;
}

function rowsFrom(sectionEl: SnapshotElement, ctx: Ctx): RowsResult {
  const content = unwrapContent(sectionEl);
  const children = contentChildren(content);

  // The whole section is one horizontal band → a single row of columns.
  if (isColumnLayout(content, children)) {
    const row = rowOf(content, children, ctx, 0.9, 'horizontal flex/grid container');
    const layoutOnSectionElement = content === sectionEl;
    if (layoutOnSectionElement) {
      // The section element and this row are the same DOM node: the
      // section keeps box styling (padding/background/border), so the
      // row must keep only layout props or they double up.
      row.styles = filterStyles(row.styles, ROW_LAYOUT_KEYS, 'keep');
    }
    return {
      rows: [row],
      layoutOnSectionElement,
    };
  }

  if (children.length === 0) {
    // Leaf-ish section (e.g. a footer with only text): one row, one column.
    return { rows: [syntheticRow(content, ctx)], layoutOnSectionElement: false };
  }

  const rows = children.map((child) => {
    const grandchildren = contentChildren(child);
    if (isColumnLayout(child, grandchildren)) {
      return rowOf(child, grandchildren, ctx, 0.9, 'horizontal flex/grid container');
    }
    return syntheticRow(child, ctx);
  });
  return { rows, layoutOnSectionElement: false };
}

function rowOf(
  el: SnapshotElement,
  columnEls: SnapshotElement[],
  ctx: Ctx,
  confidence: number,
  rationale: string,
): RowNode {
  const totalWidth = columnEls.reduce((sum, c) => sum + c.bbox.width, 0) || 1;
  return {
    id: ctx.idFn(),
    type: 'row',
    styles: responsiveFor(el, ctx),
    meta: meta(ctx, el, confidence, rationale),
    children: columnEls.map((col) =>
      columnFrom(col, ctx, Math.min(12, Math.max(1, Math.round((col.bbox.width / totalWidth) * 12)))),
    ),
  };
}

/** Block-flow child → a single-column row. */
function syntheticRow(el: SnapshotElement, ctx: Ctx): RowNode {
  return {
    id: ctx.idFn(),
    type: 'row',
    styles: { desktop: {} },
    meta: meta(ctx, el, 0.75, 'block-level flow child mapped to single-column row'),
    children: [columnFrom(el, ctx, 12)],
  };
}

function columnFrom(el: SnapshotElement, ctx: Ctx, span: number): ColumnNode {
  const direct = classifyWidget(el);
  if (direct) {
    // The column element itself is a widget (e.g. an <img> flex child):
    // wrap it in a pass-through column.
    return {
      id: ctx.idFn(),
      type: 'column',
      span,
      styles: { desktop: {} },
      meta: meta(ctx, el, direct.confidence, 'column wraps a single widget'),
      children: [widgetNode(el, direct, ctx)],
    };
  }
  const widgets: WidgetNode[] = [];
  for (const child of contentChildren(el)) collectWidgets(child, ctx, widgets);
  if (widgets.length === 0 && el.text) {
    widgets.push(textWidgetFromDirectText(el, ctx));
  }
  return {
    id: ctx.idFn(),
    type: 'column',
    span,
    styles: responsiveFor(el, ctx),
    meta: meta(ctx, el, 0.8, 'container mapped to column'),
    children: widgets,
  };
}

// ============================================================================
// Heuristic 3 & 4 — Widgets and custom-html fallback
// ============================================================================

interface WidgetGuess {
  widgetType: WidgetType;
  props: WidgetProps;
  confidence: number;
  rationale: string;
}

/**
 * Flattens an element's content into a column's widget list. Vertical
 * stacking flattens cleanly; a nested horizontal layout cannot be
 * represented inside a column, so it falls back to custom-html with
 * markup preserved.
 */
function collectWidgets(el: SnapshotElement, ctx: Ctx, out: WidgetNode[]): void {
  const guess = classifyWidget(el);
  if (guess) {
    out.push(widgetNode(el, guess, ctx));
    return;
  }
  const children = contentChildren(el);
  if (isHorizontalContainer(el) && children.length >= 2) {
    out.push(
      widgetNode(
        el,
        customHtmlGuess(el, 0.45, 'nested horizontal layout inside a column is not representable'),
        ctx,
      ),
    );
    return;
  }
  if (children.length === 0) {
    if (el.text) out.push(textWidgetFromDirectText(el, ctx));
    return;
  }
  for (const child of children) collectWidgets(child, ctx, out);
}

function widgetNode(el: SnapshotElement, guess: WidgetGuess, ctx: Ctx): WidgetNode {
  const behaviors =
    guess.widgetType === 'custom-html' || guess.widgetType === 'embed'
      ? scriptsIn(el, ctx).map((s) => behaviorFrom(s, ctx))
      : [];
  return {
    id: ctx.idFn(),
    type: 'widget',
    widgetType: guess.widgetType,
    props: guess.props,
    styles: responsiveFor(el, ctx),
    meta: meta(ctx, el, guess.confidence, guess.rationale),
    ...(behaviors.length > 0 ? { behaviors } : {}),
  };
}

function textWidgetFromDirectText(el: SnapshotElement, ctx: Ctx): WidgetNode {
  return widgetNode(
    el,
    {
      widgetType: 'text',
      props: { content: escapeHtml(el.text ?? '') },
      confidence: 0.6,
      rationale: 'loose text content mapped to text widget',
    },
    ctx,
  );
}

const INLINE_TAGS = new Set([
  'a', 'b', 'i', 'em', 'strong', 'span', 'small', 'code', 'sub', 'sup',
  'mark', 'abbr', 'time', 'u', 's', 'br',
]);
const FORM_TAGS = new Set(['form', 'input', 'select', 'textarea', 'fieldset']);
const ICON_CLASS = /(^|[-_:])(fa[srlb]?|icon|icons|material|bi|lucide|feather|glyphicon)([-_:]|$)/i;

/** True if the subtree is text plus inline markup only. */
function isTextual(el: SnapshotElement): boolean {
  return el.children.every((c) => INLINE_TAGS.has(c.tag) && isTextual(c));
}

function hasAnyText(el: SnapshotElement): boolean {
  if (el.text) return true;
  return el.children.some(hasAnyText);
}

function buttonLike(el: SnapshotElement): boolean {
  const bg = el.styles['background-color'] ?? 'rgba(0, 0, 0, 0)';
  const border = parseFloat(el.styles['border-top-width'] ?? '0') || 0;
  const radius = parseFloat(el.styles['border-radius'] ?? '0') || 0;
  const paddingX = parseFloat(el.styles['padding-left'] ?? '0') || 0;
  return bg !== 'rgba(0, 0, 0, 0)' || border > 0 || (radius > 0 && paddingX > 0);
}

function classifyWidget(el: SnapshotElement): WidgetGuess | null {
  const tag = el.tag;
  const attrs = el.attrs;

  // --- Unambiguous leaf widgets -------------------------------------------
  if (tag === 'img') {
    const width = numAttr(attrs['width']);
    const height = numAttr(attrs['height']);
    return {
      widgetType: 'image',
      props: {
        src: attrs['src'] ?? '',
        alt: attrs['alt'] ?? '',
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(attrs['loading'] === 'lazy' || attrs['loading'] === 'eager'
          ? { loading: attrs['loading'] as 'lazy' | 'eager' }
          : {}),
      },
      confidence: 0.98,
      rationale: '<img> element',
    };
  }
  if (tag === 'picture') {
    const img = findFirst(el, (e) => e.tag === 'img') ?? el.children.find((c) => c.tag === 'img');
    if (img) {
      return {
        widgetType: 'image',
        props: { src: img.attrs['src'] ?? '', alt: img.attrs['alt'] ?? '' },
        confidence: 0.9,
        rationale: '<picture> mapped to its inner <img>',
      };
    }
  }

  const headingMatch = /^h([1-6])$/.exec(tag);
  if (headingMatch) {
    return {
      widgetType: 'heading',
      props: {
        content: collectText(el),
        level: Number(headingMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6,
      },
      confidence: 0.98,
      rationale: `<${tag}> element`,
    };
  }

  if (tag === 'p' || tag === 'blockquote') {
    if (isTextual(el)) {
      return {
        widgetType: 'text',
        props: { content: innerHtml(el) },
        confidence: tag === 'p' ? 0.95 : 0.85,
        rationale: `textual <${tag}> element`,
      };
    }
    return customHtmlGuess(el, 0.5, `<${tag}> with non-inline children`);
  }

  if (tag === 'button' || (tag === 'a' && buttonLike(el) && hasAnyText(el))) {
    const href = tag === 'a' ? attrs['href'] : undefined;
    return {
      widgetType: 'button',
      props: {
        text: collectText(el),
        ...(href !== undefined ? { href } : {}),
        ...(attrs['target'] === '_blank' ? { target: '_blank' as const } : {}),
        ...(attrs['aria-label'] !== undefined ? { ariaLabel: attrs['aria-label'] } : {}),
      },
      confidence: tag === 'button' ? 0.95 : 0.85,
      rationale: tag === 'button' ? '<button> element' : '<a> with button-like styling',
    };
  }
  if (tag === 'a' && isTextual(el) && hasAnyText(el)) {
    return {
      widgetType: 'text',
      props: { content: reconstructHtml(el) },
      confidence: 0.7,
      rationale: 'plain link mapped to rich-text',
    };
  }

  // --- Icons ----------------------------------------------------------------
  if (tag === 'svg') {
    if (el.bbox.width <= 64 && el.bbox.height <= 64 && el.bbox.width > 0) {
      const label = attrs['aria-label'] ?? attrs['title'];
      return {
        widgetType: 'icon',
        props: {
          icon: 'inline-svg',
          size: Math.round(Math.max(el.bbox.width, el.bbox.height)),
          ...(el.html !== undefined ? { svg: el.html } : {}),
          ...(label !== undefined ? { ariaLabel: label } : {}),
        },
        confidence: 0.8,
        rationale: 'small inline <svg> mapped to icon',
      };
    }
    return customHtmlGuess(el, 0.55, 'large/complex <svg> preserved verbatim');
  }
  if ((tag === 'i' || tag === 'span') && !hasAnyText(el) && el.children.length === 0) {
    const iconClass = el.classes.find((c) => ICON_CLASS.test(c));
    if (iconClass) {
      const label = attrs['aria-label'] ?? attrs['title'];
      return {
        widgetType: 'icon',
        props: {
          icon: el.classes.join(' '),
          ...(label !== undefined ? { ariaLabel: label } : {}),
        },
        confidence: 0.8,
        rationale: 'icon-font element',
      };
    }
  }

  // --- Lists ------------------------------------------------------------------
  if (tag === 'ul' || tag === 'ol') {
    const items = el.children.filter((c) => c.tag === 'li');
    if (items.length > 0 && items.every(isTextual)) {
      return {
        widgetType: 'list',
        props: {
          items: items.map((li, i) => ({ id: `item-${i + 1}`, content: innerHtml(li) })),
          ordered: tag === 'ol',
        },
        confidence: 0.9,
        rationale: `<${tag}> with simple items`,
      };
    }
    return customHtmlGuess(el, 0.55, 'list with complex item structure');
  }

  // --- Media & embeds ----------------------------------------------------------
  if (tag === 'video') {
    const src = attrs['src'] ?? '';
    const vWidth = numAttr(attrs['width']);
    const vHeight = numAttr(attrs['height']);
    return {
      widgetType: 'video',
      props: {
        src,
        ...(attrs['poster'] !== undefined ? { poster: attrs['poster'] } : {}),
        ...(vWidth !== undefined ? { width: vWidth } : {}),
        ...(vHeight !== undefined ? { height: vHeight } : {}),
        autoplay: 'autoplay' in attrs,
        loop: 'loop' in attrs,
        muted: 'muted' in attrs,
        controls: 'controls' in attrs,
      },
      confidence: 0.95,
      rationale: '<video> element',
    };
  }
  if (tag === 'iframe') {
    return {
      widgetType: 'embed',
      props: {
        html: el.html ?? reconstructHtml(el),
        provider: providerFor(attrs['src'] ?? ''),
      },
      confidence: 0.9,
      rationale: '<iframe> mapped to embed',
    };
  }
  if (tag === 'audio' || tag === 'object' || tag === 'embed') {
    return {
      widgetType: 'embed',
      props: { html: el.html ?? reconstructHtml(el), provider: 'other' },
      confidence: 0.75,
      rationale: `<${tag}> preserved as embed`,
    };
  }

  // --- Confident custom-html fallbacks -------------------------------------
  if (tag === 'canvas') return customHtmlGuess(el, 0.5, '<canvas> requires custom rendering');
  if (tag.includes('-')) return customHtmlGuess(el, 0.5, `custom web component <${tag}>`);
  if (FORM_TAGS.has(tag)) return customHtmlGuess(el, 0.55, 'form controls are not yet native widgets');
  if (tag === 'table') return customHtmlGuess(el, 0.55, '<table> preserved verbatim');

  // --- Generic textual elements ----------------------------------------------
  if (hasAnyText(el) && isTextual(el) && !SECTION_TAGS.has(tag)) {
    return {
      widgetType: 'text',
      props: { content: innerHtml(el) },
      confidence: 0.75,
      rationale: `textual <${tag}> mapped to text widget`,
    };
  }

  return null; // container — caller recurses or falls back
}

function customHtmlGuess(el: SnapshotElement, confidence: number, rationale: string): WidgetGuess {
  return {
    widgetType: 'custom-html',
    props: {
      html: el.html ?? reconstructHtml(el),
      fallbackReason: rationale,
    },
    confidence,
    rationale,
  };
}

function providerFor(src: string): 'youtube' | 'vimeo' | 'twitter' | 'other' {
  if (/youtube\.com|youtu\.be/i.test(src)) return 'youtube';
  if (/vimeo\.com/i.test(src)) return 'vimeo';
  if (/twitter\.com|x\.com/i.test(src)) return 'twitter';
  return 'other';
}

function numAttr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// ============================================================================
// Markup reconstruction (for text content and non-opaque fallbacks)
// ============================================================================

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'source', 'track', 'wbr', 'area', 'col', 'embed', 'meta', 'link']);

function collectText(el: SnapshotElement): string {
  const parts: string[] = [];
  if (el.text) parts.push(el.text);
  for (const child of el.children) {
    const t = collectText(child);
    if (t) parts.push(t);
  }
  return parts.join(' ').slice(0, 500);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/**
 * Rebuilds markup from the snapshot tree. Note: interleaving of text
 * nodes with element children is approximated (direct text first) —
 * verbatim markup is used whenever the snapshot captured it (`el.html`).
 */
function reconstructHtml(el: SnapshotElement): string {
  if (el.html) return el.html;
  const attrs: string[] = [];
  if (el.id) attrs.push(`id="${escapeAttr(el.id)}"`);
  if (el.classes.length > 0) attrs.push(`class="${escapeAttr(el.classes.join(' '))}"`);
  for (const [name, value] of Object.entries(el.attrs)) {
    attrs.push(value === '' ? name : `${name}="${escapeAttr(value)}"`);
  }
  const open = `<${el.tag}${attrs.length > 0 ? ' ' + attrs.join(' ') : ''}>`;
  if (VOID_TAGS.has(el.tag)) return open;
  return `${open}${innerHtml(el)}</${el.tag}>`;
}

/**
 * Rebuilds an element's inner HTML. When the snapshot captured
 * `textRuns` (text interleaved with element children), text and children
 * are reassembled in their original order — so `By <strong>Sam</strong>
 * — 2026` round-trips faithfully. Otherwise falls back to direct text
 * followed by children.
 */
function innerHtml(el: SnapshotElement): string {
  if (el.textRuns && el.textRuns.length === el.children.length + 1) {
    let out = escapeHtml(el.textRuns[0] ?? '');
    for (let i = 0; i < el.children.length; i++) {
      out += reconstructHtml(el.children[i]!);
      out += escapeHtml(el.textRuns[i + 1] ?? '');
    }
    return out;
  }
  const text = el.text ? escapeHtml(el.text) : '';
  return text + el.children.map(reconstructHtml).join('');
}

// ============================================================================
// Heuristic 6 — Styles (desktop baseline + per-breakpoint overrides)
// ============================================================================

interface StyleMapper {
  key: keyof NodeStyles;
  /** Returns the mapped value, or undefined to drop it. */
  map?: (v: string) => StyleValue | undefined;
  /** True if the value is a default not worth serializing in the baseline. */
  isDefault?: (v: string) => boolean;
}

const zeroPx = (v: string): boolean => parseFloat(v) === 0 || v === '';
const enumOf =
  <T extends string>(allowed: readonly T[]) =>
  (v: string): T | undefined =>
    (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

/**
 * Normalizes a computed `grid-template-columns` value. Browsers resolve
 * track sizes to concrete pixels (e.g. `repeat(3, 1fr)` →
 * `437.3px 437.3px 437.3px`), which would pin the grid to one viewport
 * width. When every track is within 2px of the others, restore a fluid
 * `repeat(N, 1fr)`; otherwise keep the resolved value (better than
 * nothing for genuinely uneven grids).
 */
function normalizeGridTracks(v: string): StyleValue | undefined {
  if (v === 'none' || v.trim() === '') return undefined;
  const tracks = v.trim().split(/\s+/);
  const px = tracks.map((t) => parseFloat(t));
  if (px.some((n) => Number.isNaN(n))) return v; // already has fr/%/keywords
  if (tracks.length === 1) return '1fr'; // a lone resolved track → fluid
  const min = Math.min(...px);
  const max = Math.max(...px);
  if (max - min <= 2) return `repeat(${tracks.length}, 1fr)`;
  return v;
}

const STYLE_MAPPERS: Record<string, StyleMapper> = {
  'display': { key: 'display', map: enumOf(['block', 'flex', 'grid', 'inline-block', 'none'] as const), isDefault: (v) => v === 'block' || v === 'inline' },
  'position': { key: 'position', map: enumOf(['static', 'relative', 'absolute', 'fixed', 'sticky'] as const), isDefault: (v) => v === 'static' },
  'flex-direction': { key: 'flexDirection', map: enumOf(['row', 'column', 'row-reverse', 'column-reverse'] as const) },
  'justify-content': { key: 'justifyContent', map: enumOf(['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] as const), isDefault: (v) => v === 'normal' || v === 'flex-start' },
  'align-items': { key: 'alignItems', map: enumOf(['flex-start', 'center', 'flex-end', 'stretch', 'baseline'] as const), isDefault: (v) => v === 'normal' || v === 'stretch' },
  'gap': { key: 'gap', map: (v) => (v === 'normal' ? undefined : v), isDefault: zeroPx },
  'grid-template-columns': { key: 'gridTemplateColumns', map: normalizeGridTracks },
  // Computed grid-template-rows is always resolved to pixel heights that
  // fight the actual content; let rows size automatically instead.
  'grid-template-rows': { key: 'gridTemplateRows', map: () => undefined },
  'color': { key: 'color', isDefault: (v) => v === 'rgb(0, 0, 0)' },
  'background-color': { key: 'backgroundColor', isDefault: (v) => v === 'rgba(0, 0, 0, 0)' },
  'background-image': { key: 'backgroundImage', isDefault: (v) => v === 'none' },
  'flex-wrap': { key: 'flexWrap', map: enumOf(['nowrap', 'wrap', 'wrap-reverse'] as const), isDefault: (v) => v === 'nowrap' },
  'flex-grow': { key: 'flexGrow', map: (v) => Number(v), isDefault: (v) => v === '0' },
  'flex-shrink': { key: 'flexShrink', map: (v) => Number(v), isDefault: (v) => v === '1' },
  'flex-basis': { key: 'flexBasis', isDefault: (v) => v === 'auto' },
  'box-sizing': { key: 'boxSizing', map: enumOf(['content-box', 'border-box'] as const), isDefault: (v) => v === 'border-box' },
  'max-width': { key: 'maxWidth', isDefault: (v) => v === 'none' },
  'width': { key: 'width', isDefault: (v) => v === 'auto' },
  'height': { key: 'height', isDefault: (v) => v === 'auto' },
  'font-family': { key: 'fontFamily', isDefault: (v) => v.includes('Times') },
  'font-size': { key: 'fontSize', isDefault: (v) => v === '16px' },
  'font-weight': { key: 'fontWeight', isDefault: (v) => v === '400' || v === 'normal' },
  'font-style': { key: 'fontStyle', map: enumOf(['normal', 'italic'] as const), isDefault: (v) => v === 'normal' },
  'line-height': { key: 'lineHeight', isDefault: (v) => v === 'normal' },
  'letter-spacing': { key: 'letterSpacing', isDefault: (v) => v === 'normal' },
  'text-align': { key: 'textAlign', map: enumOf(['left', 'center', 'right', 'justify'] as const), isDefault: (v) => v === 'start' || v === 'left' },
  'text-transform': { key: 'textTransform', map: enumOf(['none', 'uppercase', 'lowercase', 'capitalize'] as const), isDefault: (v) => v === 'none' },
  'text-decoration-line': { key: 'textDecoration', map: enumOf(['none', 'underline', 'line-through'] as const), isDefault: (v) => v === 'none' },
  'list-style-type': { key: 'listStyleType', isDefault: (v) => v === 'disc' || v === 'decimal' },
  'margin-top': { key: 'marginTop', isDefault: zeroPx },
  'margin-right': { key: 'marginRight', isDefault: zeroPx },
  'margin-bottom': { key: 'marginBottom', isDefault: zeroPx },
  'margin-left': { key: 'marginLeft', isDefault: zeroPx },
  'padding-top': { key: 'paddingTop', isDefault: zeroPx },
  'padding-right': { key: 'paddingRight', isDefault: zeroPx },
  'padding-bottom': { key: 'paddingBottom', isDefault: zeroPx },
  'padding-left': { key: 'paddingLeft', isDefault: zeroPx },
  'border-top-width': { key: 'borderTopWidth', isDefault: zeroPx },
  'border-right-width': { key: 'borderRightWidth', isDefault: zeroPx },
  'border-bottom-width': { key: 'borderBottomWidth', isDefault: zeroPx },
  'border-left-width': { key: 'borderLeftWidth', isDefault: zeroPx },
  'border-style': { key: 'borderStyle', map: enumOf(['none', 'solid', 'dashed', 'dotted'] as const), isDefault: (v) => v === 'none' },
  'border-color': { key: 'borderColor' },
  'border-radius': { key: 'borderRadius', isDefault: zeroPx },
  'box-shadow': { key: 'boxShadow', isDefault: (v) => v === 'none' },
};

/** Maps captured computed styles onto schema NodeStyles. */
export function mapStyles(
  computed: Record<string, string>,
  { filterDefaults, keepSize = false }: { filterDefaults: boolean; keepSize?: boolean },
): NodeStyles {
  const out: Record<string, StyleValue> = {};
  for (const [prop, value] of Object.entries(computed)) {
    const mapper = STYLE_MAPPERS[prop];
    if (!mapper || value === '') continue;
    if (filterDefaults && mapper.isDefault?.(value)) continue;
    const mapped = mapper.map ? mapper.map(value) : value;
    if (mapped !== undefined) out[mapper.key] = mapped;
  }
  if (filterDefaults) {
    // Flex/grid child props are noise on non-flex/grid containers.
    if (out['display'] !== 'flex' && out['display'] !== 'grid') {
      delete out['flexDirection'];
      delete out['justifyContent'];
      delete out['alignItems'];
      delete out['flexWrap'];
      delete out['gap'];
      delete out['gridTemplateColumns'];
      delete out['gridTemplateRows'];
    }
    // flex-direction/flex-wrap are meaningless on a grid container.
    if (out['display'] === 'grid') {
      delete out['flexDirection'];
      delete out['flexWrap'];
    }
    // Collapse uniform per-side border widths into borderWidth; drop
    // color/style entirely when no side has a border.
    const sides = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const;
    const widths = sides.map((s) => out[s]);
    if (widths.every((w) => w === undefined)) {
      delete out['borderColor'];
      delete out['borderStyle'];
    } else if (widths.every((w) => w !== undefined && w === widths[0])) {
      out['borderWidth'] = widths[0]!;
      for (const s of sides) delete out[s];
    }
  }
  // Concrete computed width/height are only safe to emit for media
  // widgets (img/video), whose rendered box must be reproduced. On
  // containers they would pin the box and break responsive reflow.
  if (!keepSize) {
    delete out['width'];
    delete out['height'];
  }
  return out as NodeStyles;
}

/** Layout props that belong on the row, not a doubled-up section. */
const ROW_LAYOUT_KEYS: (keyof NodeStyles)[] = [
  'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems',
  'gap', 'gridTemplateColumns', 'gridTemplateRows',
];

/**
 * Returns a copy of `styles` keeping ('keep') or dropping ('omit') the
 * given keys, across desktop and every breakpoint override.
 */
function filterStyles(
  styles: ResponsiveStyles,
  keys: (keyof NodeStyles)[],
  mode: 'keep' | 'omit',
): ResponsiveStyles {
  const set = new Set<string>(keys as string[]);
  const pick = <T extends Partial<NodeStyles>>(obj: T): T => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const hit = set.has(k);
      if (mode === 'keep' ? hit : !hit) out[k] = v;
    }
    return out as T;
  };
  const result: ResponsiveStyles = { desktop: pick(styles.desktop) };
  if (styles.tablet) result.tablet = pick(styles.tablet);
  if (styles.mobile) result.mobile = pick(styles.mobile);
  return result;
}

/** Tags whose rendered size must be reproduced (see `keepSize`). */
const SIZED_TAGS = new Set(['video', 'canvas', 'svg', 'iframe']);

function responsiveFor(el: SnapshotElement, ctx: Ctx): ResponsiveStyles {
  const keepSize = SIZED_TAGS.has(el.tag);
  const styles: ResponsiveStyles = {
    desktop: mapStyles(el.styles, { filterDefaults: true, keepSize }),
  };
  for (const bp of ['tablet', 'mobile'] as const) {
    const diff = ctx.snapshot.breakpointStyles?.[bp]?.[String(el.index)];
    if (!diff) continue;
    const mapped = mapStyles(diff, { filterDefaults: false, keepSize });
    if (Object.keys(mapped).length > 0) styles[bp] = mapped;
  }
  return styles;
}

// ============================================================================
// Design tokens — repeated colors become global tokens
// ============================================================================

const TOKENIZED_COLOR_KEYS = ['color', 'backgroundColor', 'borderColor'] as const;

/** A color must appear this many times across the tree to become a token. */
const TOKEN_MIN_USES = 3;

/**
 * Scans the finished tree for repeated color literals, promotes them to
 * `GlobalTokens.colors` entries, and rewrites every occurrence (desktop
 * and breakpoint overrides alike) into a `{type:'token'}` reference so
 * codegen emits `var(--color-N)` instead of duplicated literals.
 */
function extractColorTokens(page: PageNode): GlobalTokens {
  const uses = new Map<string, number>();
  const visitStyles = (styles: Partial<NodeStyles>): void => {
    for (const key of TOKENIZED_COLOR_KEYS) {
      const value = styles[key];
      if (typeof value === 'string') uses.set(value, (uses.get(value) ?? 0) + 1);
    }
  };
  walk(page, (n) => {
    visitStyles(n.styles.desktop);
    if (n.styles.tablet) visitStyles(n.styles.tablet);
    if (n.styles.mobile) visitStyles(n.styles.mobile);
  });

  const colors: ColorToken[] = [];
  const tokenIdByValue = new Map<string, string>();
  // Insertion order of `uses` follows tree walk order → deterministic.
  for (const [value, count] of uses) {
    if (count < TOKEN_MIN_USES) continue;
    const id = `color-${colors.length + 1}`;
    tokenIdByValue.set(value, id);
    colors.push({ id, name: `Color ${colors.length + 1}`, value });
  }
  if (colors.length === 0) return { colors: [], typography: [] };

  walk(page, (n) => {
    for (const styles of [n.styles.desktop, n.styles.tablet, n.styles.mobile]) {
      if (!styles) continue;
      for (const key of TOKENIZED_COLOR_KEYS) {
        const value = styles[key];
        if (typeof value === 'string') {
          const tokenId = tokenIdByValue.get(value);
          if (tokenId !== undefined) styles[key] = { type: 'token', tokenId };
        }
      }
    }
  });
  return { colors, typography: [] };
}

// ============================================================================
// Heuristic 5 — Stats & low-confidence reporting
// ============================================================================

type AnyNode = PageNode | SectionNode | RowNode | ColumnNode | WidgetNode;

function walk(node: AnyNode, visit: (n: AnyNode) => void): void {
  visit(node);
  if (node.type !== 'widget') {
    for (const child of node.children) walk(child as AnyNode, visit);
  }
}

function computeStats(page: PageNode): ClassificationStats {
  const byType: Partial<Record<WidgetType, number>> = {};
  let total = 0;
  let sectionCount = 0;
  walk(page, (n) => {
    if (n.type === 'section') sectionCount++;
    if (n.type === 'widget') {
      total++;
      byType[n.widgetType] = (byType[n.widgetType] ?? 0) + 1;
    }
  });
  const customHtmlCount = byType['custom-html'] ?? 0;
  return {
    totalWidgets: total,
    sectionCount,
    byType,
    customHtmlCount,
    cleanMappingRate: total === 0 ? 1 : (total - customHtmlCount) / total,
  };
}

function collectLowConfidence(page: PageNode, threshold: number): LowConfidenceEntry[] {
  const entries: LowConfidenceEntry[] = [];
  walk(page, (n) => {
    const confidence = n.meta.confidence;
    if (confidence === undefined || confidence >= threshold) return;
    entries.push({
      nodeId: n.id,
      nodeType: n.type,
      ...(n.type === 'widget' ? { widgetType: n.widgetType } : {}),
      confidence,
      rationale: n.meta.notes ?? '',
      ...(n.meta.originalElement?.selector !== undefined
        ? { selector: n.meta.originalElement.selector }
        : {}),
    });
  });
  return entries;
}
