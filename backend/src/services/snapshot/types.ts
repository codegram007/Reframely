/**
 * DOM Snapshot Service types.
 *
 * One `PageSnapshot` JSON document is produced per rendered page and
 * stored alongside the source project at
 * `projects/{projectId}/snapshots/{pageSlug}.json`, with screenshots at
 * `projects/{projectId}/snapshots/{pageSlug}.{viewport}.png`.
 */

/** Viewports we render for visual QA / "did this import look right". */
export interface Viewport {
  name: 'desktop' | 'tablet' | 'mobile';
  width: number;
  height: number;
}

export const VIEWPORTS: readonly Viewport[] = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

/**
 * Computed-style properties captured per element. These are the
 * properties classification cares about — captured *computed*, so
 * Tailwind/utility-class sites resolve to concrete values.
 */
export const CAPTURED_STYLE_PROPS = [
  'display',
  'position',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'box-sizing',
  'max-width',
  'width',
  'height',
  'color',
  'background-color',
  'background-image',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration-line',
  'list-style-type',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'border-color',
  'border-radius',
  'box-shadow',
] as const;

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One element in the rendered (post-JS) DOM tree. */
export interface SnapshotElement {
  /** Pre-order traversal index; keys `breakpointStyles` diff entries. */
  index: number;
  tag: string;
  id?: string;
  classes: string[];
  /** Non-class, non-id attributes (href, src, alt, aria-*, data-*, ...). */
  attrs: Record<string, string>;
  /** Direct text content of this element (children's text excluded), trimmed. */
  text?: string;
  /**
   * Interleaved text runs around element children, present only when the
   * element mixes text nodes with element children: `textRuns[i]` is the
   * (whitespace-collapsed) text before `children[i]`, and the final entry
   * is the trailing text. Length is always `children.length + 1`.
   * Preserves inline ordering like `By <strong>Sam</strong> — 2026`.
   */
  textRuns?: string[];
  /** Computed styles at the desktop viewport, keyed by CSS property. */
  styles: Record<string, string>;
  /** Layout box at the desktop viewport, for column/row inference. */
  bbox: BoundingBox;
  /**
   * `src` of external / marker for inline `<script>` tags that are
   * DIRECT children of this element — feeds later `behaviors` mapping.
   */
  scriptRefs: string[];
  children: SnapshotElement[];
  /**
   * Verbatim outerHTML, captured only for "opaque" elements (svg,
   * canvas, iframe, video, audio, object, embed, custom elements) whose
   * internals are not descended into. Length-capped.
   */
  html?: string;
}

/** Page-level script reference with its location in the DOM. */
export interface ScriptRef {
  /** Resolved `src` for external scripts; undefined for inline scripts. */
  src?: string;
  inline: boolean;
  /** CSS-ish path of the script's parent element, e.g. `html > body > div#app`. */
  parentPath: string;
  /** Pre-order index of the parent element in `dom`. */
  parentIndex: number;
  /** Inline script source (length-capped); absent for external scripts. */
  content?: string;
}

/**
 * Sparse computed-style overrides versus the desktop baseline, produced
 * by re-running extraction at each viewport width and diffing. Keyed by
 * the element's pre-order `index` (as a string); only properties whose
 * computed value actually differs from desktop appear.
 */
export interface BreakpointStyleDiffs {
  tablet: Record<string, Record<string, string>>;
  mobile: Record<string, Record<string, string>>;
}

export interface PageSnapshot {
  /** Path of the page within the project/site, e.g. `/` or `/about.html`. */
  pagePath: string;
  /** URL the page was rendered from (real URL or virtual origin). */
  renderedUrl: string;
  title: string;
  capturedAt: string;
  viewport: Viewport;
  /** Serialized post-JS-execution HTML (`documentElement.outerHTML`). */
  renderedHtml: string;
  /** Rendered DOM tree with computed styles + layout boxes. */
  dom: SnapshotElement;
  /** All script tags on the page with their DOM locations. */
  scripts: ScriptRef[];
  /** Same-origin internal links discovered on the page (normalized paths). */
  internalLinks: string[];
  /**
   * Per-breakpoint computed-style diffs vs the desktop baseline (media
   * queries, responsive utility classes). Empty maps if the DOM
   * structure changed between viewports and elements could not be
   * matched by pre-order index.
   */
  breakpointStyles: BreakpointStyleDiffs;
  /** Object-store keys of the screenshots, keyed by viewport name. */
  screenshots: Record<string, string>;
  /** True if the element tree was truncated at the extraction cap. */
  domTruncated: boolean;
}

export interface SnapshotResult {
  projectId: string;
  pageCount: number;
  pages: {
    pagePath: string;
    /** Object-store key of the PageSnapshot JSON document. */
    snapshotKey: string;
    screenshots: Record<string, string>;
  }[];
}
