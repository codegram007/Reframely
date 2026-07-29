/**
 * B13 — conservative "Clean up this import" proposal service.
 *
 * Low-confidence, overly broad custom-html widgets are decomposed into native
 * widgets. A candidate is returned only after patch validation and a B6-style
 * desktop/tablet/mobile screenshot comparison succeeds.
 */
import { randomUUID } from 'node:crypto';
import { chromium, type Browser } from 'playwright';
import {
  applyTreePatch,
  assertWidgetTree,
  PatchValidationError,
  type PatchOperation,
  type TreePatch,
} from '../../lib/tree-patch.js';
import { compareTreeVisuals, type VisualDiffResult } from '../../lib/visual-parity.js';
import type {
  ColumnNode,
  NodeMeta,
  ResponsiveStyles,
  TreeNode,
  WidgetNode,
  WidgetTree,
} from '../classifier/schema.js';

export type CleanupErrorCode = 'INVALID_TREE' | 'NO_TARGETS' | 'INVALID_PATCH';

export class CleanupError extends Error {
  constructor(
    readonly code: CleanupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CleanupError';
  }
}

export interface CleanupRequest {
  projectId?: string;
  tree: unknown;
  confidenceThreshold?: number;
}

export interface CleanupStats {
  targetNodeId: string;
  confidenceBefore: number;
  nativeWidgetsProposed: number;
  customHtmlBefore: number;
  customHtmlAfter: number;
}

export interface CleanupResponse {
  patches: TreePatch[];
  candidateTree?: WidgetTree;
  visualDiff: VisualDiffResult;
  stats: CleanupStats;
  assistantMessage: string;
}

export interface HtmlDescriptor {
  tag: string;
  outerHtml: string;
  innerHtml: string;
  text: string;
  className: string;
  attrs: Record<string, string>;
  children: HtmlDescriptor[];
  inlineOnly: boolean;
}

export interface CleanupServiceDeps {
  browser?: Browser;
  inspectHtml?: (html: string) => Promise<HtmlDescriptor>;
  compareVisuals?: (before: WidgetTree, after: WidgetTree) => Promise<VisualDiffResult>;
  now?: () => Date;
  idFn?: () => string;
}

interface Target {
  widget: WidgetNode;
  column: ColumnNode;
  position: number;
}

const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'br', 'code', 'em', 'i', 'mark', 'small', 'span',
  'strong', 'sub', 'sup', 'time', 'u', 's',
]);

/** Uses Chromium's HTML parser rather than attempting to parse markup with regex. */
export async function inspectCustomHtml(browser: Browser, html: string): Promise<HtmlDescriptor> {
  const page = await browser.newPage();
  try {
    const serialized = await page.evaluate(`(() => {
      const inline = new Set(${JSON.stringify([...INLINE_TAGS])});
      const parsed = new DOMParser().parseFromString(${JSON.stringify(html)}, 'text/html');
      const describe = (element) => ({
        tag: element.tagName.toLowerCase(),
        outerHtml: element.outerHTML,
        innerHtml: element.innerHTML,
        text: element.textContent || '',
        className: typeof element.className === 'string' ? element.className : '',
        attrs: Object.fromEntries(Array.from(element.attributes).map((attr) => [attr.name, attr.value])),
        children: Array.from(element.children).map(describe),
        inlineOnly: Array.from(element.children).every((child) => inline.has(child.tagName.toLowerCase())),
      });
      const root = parsed.body.firstElementChild;
      return root ? JSON.stringify(describe(root)) : '';
    })()`);
    if (typeof serialized !== 'string' || serialized.length === 0) {
      throw new CleanupError('NO_TARGETS', 'The custom-html node has no element root to restructure.');
    }
    return JSON.parse(serialized) as HtmlDescriptor;
  } finally {
    await page.close();
  }
}

function childrenOf(node: TreeNode): TreeNode[] {
  return node.type === 'widget' ? [] : (node.children as TreeNode[]);
}

function findTarget(tree: WidgetTree, threshold: number): Target | null {
  let target: Target | null = null;
  const walk = (node: TreeNode, parent: TreeNode | null): void => {
    if (target) return;
    if (
      node.type === 'widget' &&
      node.widgetType === 'custom-html' &&
      (node.meta.confidence ?? 1) < threshold &&
      parent?.type === 'column' &&
      parent.children.length === 1
    ) {
      target = { widget: node, column: parent, position: 0 };
      return;
    }
    for (const child of childrenOf(node)) walk(child, node);
  };
  walk(tree.root, null);
  return target;
}

function metaFor(descriptor: HtmlDescriptor, now: string, confidence: number, notes: string): NodeMeta {
  return {
    source: 'ai-generated',
    originalElement: {
      tagName: descriptor.tag,
      ...(descriptor.className ? { className: descriptor.className } : {}),
    },
    confidence,
    notes,
    createdAt: now,
    updatedAt: now,
  };
}

function emptyStyles(): ResponsiveStyles {
  return { desktop: {} };
}

function numberAttr(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function descriptorToWidget(
  descriptor: HtmlDescriptor,
  id: string,
  now: string,
): WidgetNode | null {
  const base = {
    id,
    type: 'widget' as const,
    styles: emptyStyles(),
  };
  const heading = /^h([1-6])$/.exec(descriptor.tag);
  if (heading && descriptor.children.length === 0) {
    return {
      ...base,
      widgetType: 'heading',
      props: { content: descriptor.text, level: Number(heading[1]) as 1 | 2 | 3 | 4 | 5 | 6 },
      meta: metaFor(descriptor, now, 0.98, 'B13: decomposed heading from broad custom HTML'),
    };
  }
  if (['p', 'blockquote', 'span', 'small'].includes(descriptor.tag) && descriptor.inlineOnly) {
    return {
      ...base,
      widgetType: 'text',
      props: { content: descriptor.innerHtml },
      meta: metaFor(descriptor, now, 0.95, 'B13: decomposed rich text from broad custom HTML'),
    };
  }
  if (descriptor.tag === 'img') {
    const width = numberAttr(descriptor.attrs['width']);
    const height = numberAttr(descriptor.attrs['height']);
    return {
      ...base,
      widgetType: 'image',
      props: {
        src: descriptor.attrs['src'] ?? '',
        alt: descriptor.attrs['alt'] ?? '',
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(descriptor.attrs['loading'] === 'lazy' || descriptor.attrs['loading'] === 'eager'
          ? { loading: descriptor.attrs['loading'] }
          : {}),
      },
      meta: metaFor(descriptor, now, 0.98, 'B13: decomposed image from broad custom HTML'),
    };
  }
  if (descriptor.tag === 'button' && descriptor.children.length === 0) {
    return {
      ...base,
      widgetType: 'button',
      props: {
        text: descriptor.text,
        ...(descriptor.attrs['aria-label'] ? { ariaLabel: descriptor.attrs['aria-label'] } : {}),
      },
      meta: metaFor(descriptor, now, 0.95, 'B13: decomposed button from broad custom HTML'),
    };
  }
  if ((descriptor.tag === 'ul' || descriptor.tag === 'ol') && descriptor.children.every((c) => c.tag === 'li')) {
    return {
      ...base,
      widgetType: 'list',
      props: {
        ordered: descriptor.tag === 'ol',
        items: descriptor.children.map((item, index) => ({
          id: `item-${index + 1}`,
          content: item.innerHtml,
        })),
      },
      meta: metaFor(descriptor, now, 0.9, 'B13: decomposed list from broad custom HTML'),
    };
  }
  return null;
}

function collectNativeWidgets(
  descriptor: HtmlDescriptor,
  idFn: () => string,
  now: string,
  output: WidgetNode[],
): void {
  const widget = descriptorToWidget(descriptor, idFn(), now);
  if (widget) {
    output.push(widget);
    return;
  }
  for (const child of descriptor.children) collectNativeWidgets(child, idFn, now, output);
}

function styleOperations(column: ColumnNode, target: WidgetNode): PatchOperation[] {
  const operations: PatchOperation[] = [];
  for (const breakpoint of ['desktop', 'tablet', 'mobile'] as const) {
    const styles = target.styles[breakpoint];
    if (styles && Object.keys(styles).length > 0) {
      operations.push({
        op: 'update_styles',
        nodeId: column.id,
        breakpoint,
        styles,
      });
    }
  }
  for (const behavior of target.behaviors ?? []) {
    operations.push({ op: 'add_behavior', nodeId: column.id, behavior });
  }
  return operations;
}

function countCustomHtml(tree: WidgetTree): number {
  let count = 0;
  const walk = (node: TreeNode): void => {
    if (node.type === 'widget' && node.widgetType === 'custom-html') count++;
    for (const child of childrenOf(node)) walk(child);
  };
  walk(tree.root);
  return count;
}

export class CleanupService {
  private readonly browser: Browser | undefined;
  private readonly inspectFn: CleanupServiceDeps['inspectHtml'];
  private readonly compareFn: CleanupServiceDeps['compareVisuals'];
  private readonly now: () => Date;
  private readonly idFn: () => string;

  constructor(deps: CleanupServiceDeps = {}) {
    this.browser = deps.browser;
    this.inspectFn = deps.inspectHtml;
    this.compareFn = deps.compareVisuals;
    this.now = deps.now ?? (() => new Date());
    this.idFn = deps.idFn ?? (() => `b13_${randomUUID().replace(/-/g, '').slice(0, 12)}`);
  }

  async run(request: CleanupRequest): Promise<CleanupResponse> {
    try {
      assertWidgetTree(request.tree);
    } catch (error) {
      throw new CleanupError(
        'INVALID_TREE',
        error instanceof Error ? error.message : 'Request must include a valid widget tree.',
      );
    }
    const tree = request.tree;
    const threshold = request.confidenceThreshold ?? 0.7;
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      throw new CleanupError('INVALID_TREE', 'confidenceThreshold must be greater than 0 and at most 1.');
    }
    const target = findTarget(tree, threshold);
    if (!target) {
      throw new CleanupError(
        'NO_TARGETS',
        'No low-confidence custom-html node with a safely replaceable column was found.',
      );
    }

    let ownedBrowser: Browser | undefined;
    try {
      const needsBrowser = !this.inspectFn || !this.compareFn;
      const browser = this.browser ?? (needsBrowser ? (ownedBrowser = await chromium.launch()) : undefined);
      const html = (target.widget.props as { html: string }).html;
      const descriptor = this.inspectFn
        ? await this.inspectFn(html)
        : await inspectCustomHtml(browser!, html);
      const createdAt = this.now().toISOString();
      const widgets: WidgetNode[] = [];
      for (const child of descriptor.children) {
        collectNativeWidgets(child, this.idFn, createdAt, widgets);
      }
      if (widgets.length < 2) {
        throw new CleanupError(
          'NO_TARGETS',
          'The fallback could not be decomposed into at least two schema-native widgets.',
        );
      }

      const operations: PatchOperation[] = [
        ...styleOperations(target.column, target.widget),
        ...widgets.map((node, index): PatchOperation => ({
          op: 'insert_node',
          parentId: target.column.id,
          position: target.position + index,
          node,
        })),
        { op: 'delete_node', nodeId: target.widget.id },
      ];
      const patch: TreePatch = {
        patchId: this.idFn(),
        createdAt,
        operations: [{ op: 'batch', operations }],
        confidence: 0.9,
        rationale: `Replace low-confidence custom HTML ${target.widget.id} with ${widgets.length} native widgets.`,
        affectedNodeIds: [target.widget.id, target.column.id, ...widgets.map((widget) => widget.id)],
      };

      let candidateTree: WidgetTree;
      try {
        candidateTree = applyTreePatch(tree, patch);
      } catch (error) {
        throw new CleanupError(
          'INVALID_PATCH',
          error instanceof PatchValidationError ? error.message : 'Cleanup patch failed validation.',
        );
      }

      const stats: CleanupStats = {
        targetNodeId: target.widget.id,
        confidenceBefore: target.widget.meta.confidence ?? 0,
        nativeWidgetsProposed: widgets.length,
        customHtmlBefore: countCustomHtml(tree),
        customHtmlAfter: countCustomHtml(candidateTree),
      };
      const visualDiff = this.compareFn
        ? await this.compareFn(tree, candidateTree)
        : await compareTreeVisuals(browser!, tree, candidateTree);

      if (!visualDiff.passed) {
        return {
          patches: [],
          visualDiff,
          stats,
          assistantMessage: 'Cleanup candidate was rejected because it changed visual output.',
        };
      }
      return {
        patches: [patch],
        candidateTree,
        visualDiff,
        stats,
        assistantMessage: `Proposed ${widgets.length} native widgets; visual parity passed at all breakpoints.`,
      };
    } catch (error) {
      if (error instanceof CleanupError) throw error;
      throw new CleanupError('INVALID_PATCH', error instanceof Error ? error.message : 'Cleanup failed.');
    } finally {
      await ownedBrowser?.close();
    }
  }
}
