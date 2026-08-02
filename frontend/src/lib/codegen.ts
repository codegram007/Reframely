/**
 * Widget tree → static HTML + CSS generator (pure) — FRONTEND MIRROR.
 *
 * Canonical source: `backend/src/services/codegen/generate.ts`. This is
 * a byte-faithful copy with imports repointed at the frontend schema
 * mirror. It runs client-side so the canvas re-renders instantly on
 * every tree edit — no network round-trip. Because it's a copy, the two
 * files must stay in sync; a shared package would remove the
 * duplication later (both are pure string-builders with no runtime deps,
 * so extraction is mechanical when we're ready).
 *
 * Determinism: same tree in, same bytes out. No I/O, no clock.
 */
import type {
  Behavior,
  ButtonWidgetProps,
  ColumnNode,
  CustomHtmlWidgetProps,
  EmbedWidgetProps,
  GlobalTokens,
  HeadingWidgetProps,
  IconWidgetProps,
  ImageWidgetProps,
  ListWidgetProps,
  NodeStyles,
  PageNode,
  ResponsiveStyles,
  RowNode,
  SectionNode,
  StyleValue,
  TextWidgetProps,
  VideoWidgetProps,
  WidgetNode,
  WidgetTree,
} from './schema';

export interface GenerateOptions {
  cssHref?: string;
}

export interface GeneratedPage {
  html: string;
  css: string;
}

export const TABLET_MAX_WIDTH = 1024;
export const MOBILE_MAX_WIDTH = 480;

export function generatePage(tree: WidgetTree, options: GenerateOptions = {}): GeneratedPage {
  const css = generateCss(tree);
  const html = generateHtml(tree, css, options);
  return { html, css };
}

// ============================================================================
// CSS generation
// ============================================================================

type AnyNode = PageNode | SectionNode | RowNode | ColumnNode | WidgetNode;

function walk(node: AnyNode, visit: (n: AnyNode) => void): void {
  visit(node);
  if (node.type !== 'widget') {
    for (const child of node.children) walk(child as AnyNode, visit);
  }
}

export function classFor(node: AnyNode): string {
  return `vs-${node.id}`;
}

const UNITLESS = new Set(['opacity', 'zIndex', 'fontWeight', 'flexGrow', 'flexShrink', 'lineHeight']);

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function cssValue(key: string, value: StyleValue): string {
  if (typeof value === 'object') return `var(--${value.tokenId})`;
  if (typeof value === 'number') return UNITLESS.has(key) ? String(value) : `${value}px`;
  return value;
}

export function declarationsFor(styles: NodeStyles | Partial<NodeStyles>): string[] {
  const decls: string[] = [];
  for (const key of Object.keys(styles).sort()) {
    if (key === 'visible') {
      if ((styles as Record<string, unknown>)['visible'] === false) decls.push('display: none');
      continue;
    }
    const value = (styles as Record<string, StyleValue | undefined>)[key];
    if (value === undefined) continue;
    decls.push(`${camelToKebab(key)}: ${cssValue(key, value)}`);
  }
  return decls;
}

function ruleFor(selector: string, styles: NodeStyles | Partial<NodeStyles>, indent = ''): string | undefined {
  const decls = declarationsFor(styles);
  if (decls.length === 0) return undefined;
  return `${indent}.${selector} {\n${decls.map((d) => `${indent}  ${d};`).join('\n')}\n${indent}}`;
}

function tokensCss(tokens: GlobalTokens): string | undefined {
  const decls: string[] = [];
  for (const color of tokens.colors) {
    decls.push(`  --${color.id}: ${color.value}; /* ${color.name} */`);
  }
  for (const typo of tokens.typography) {
    decls.push(`  --${typo.id}-font-family: ${typo.fontFamily}; /* ${typo.name} */`);
    decls.push(`  --${typo.id}-font-size: ${typo.fontSize};`);
    decls.push(`  --${typo.id}-font-weight: ${typo.fontWeight};`);
    decls.push(`  --${typo.id}-line-height: ${typo.lineHeight};`);
  }
  if (decls.length === 0) return undefined;
  return `:root {\n${decls.join('\n')}\n}`;
}

const RESET_CSS = `*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid;
}
a {
  color: inherit;
  text-decoration: none;
}`;

export function generateCss(tree: WidgetTree): string {
  const base: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];

  walk(tree.root, (node) => {
    const cls = classFor(node);
    const styles: ResponsiveStyles = node.styles;
    const extra = extraStylesFor(node);
    const desktop: Partial<NodeStyles> = { ...extra, ...styles.desktop };
    const rule = ruleFor(cls, desktop);
    if (rule) base.push(rule);

    if (styles.tablet) {
      const t = ruleFor(cls, styles.tablet, '  ');
      if (t) tablet.push(t);
    }
    if (styles.mobile || styles.tablet) {
      const reverted: Partial<NodeStyles> = { ...(styles.mobile ?? {}) };
      for (const key of Object.keys(styles.tablet ?? {}) as (keyof NodeStyles)[]) {
        if (reverted[key] === undefined && desktop[key] !== undefined) {
          (reverted as Record<string, StyleValue>)[key as string] = desktop[key] as StyleValue;
        }
      }
      const m = ruleFor(cls, reverted, '  ');
      if (m) mobile.push(m);
    }
  });

  const parts: string[] = ['/* Generated by Reframely codegen */', RESET_CSS];
  const tokens = tokensCss(tree.tokens);
  if (tokens) parts.push(tokens);
  parts.push(...base);
  if (tablet.length > 0) {
    parts.push(`@media (max-width: ${TABLET_MAX_WIDTH}px) {\n${tablet.join('\n')}\n}`);
  }
  if (mobile.length > 0) {
    parts.push(`@media (max-width: ${MOBILE_MAX_WIDTH}px) {\n${mobile.join('\n')}\n}`);
  }
  return parts.join('\n\n') + '\n';
}

function extraStylesFor(node: AnyNode): Partial<NodeStyles> {
  if (node.type !== 'widget') return {};
  if (node.widgetType === 'icon') {
    const props = node.props as IconWidgetProps;
    if (props.svg === undefined && props.size !== undefined) {
      return { width: `${props.size}px`, height: `${props.size}px`, display: 'inline-block' };
    }
  }
  if (node.widgetType === 'image') {
    return { maxWidth: '100%', height: 'auto', display: 'block' };
  }
  return {};
}

// ============================================================================
// HTML generation
// ============================================================================

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

export function injectClass(html: string, cls: string, id?: string): string {
  return html.replace(/^(\s*<[a-zA-Z][\w-]*)((?:[^>"]|"[^"]*")*)(>)/, (_m, open: string, attrs: string, close: string) => {
    let nextAttrs: string;
    if (/\sclass="/.test(attrs)) {
      nextAttrs = attrs.replace(/\sclass="([^"]*)"/, (_c, existing: string) => ` class="${existing} ${cls}"`);
    } else {
      nextAttrs = ` class="${cls}"${attrs}`;
    }
    if (id !== undefined && !/\sid="/.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/(\sclass="[^"]*")/, `$1 id="${id}"`);
    }
    return `${open}${nextAttrs}${close}`;
  });
}

const SEMANTIC_SECTION_TAGS = new Set(['header', 'footer', 'section', 'nav', 'aside', 'article', 'main']);
const TEXT_WRAPPER_TAGS = new Set(['p', 'blockquote', 'figcaption', 'span', 'div', 'li', 'address', 'small']);

function attrsString(attrs: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    parts.push(value === '' ? `${name}=""` : `${name}="${escapeAttr(value)}"`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

function idAttrFor(node: AnyNode): string {
  return node.behaviors && node.behaviors.length > 0 ? ` id="${classFor(node)}"` : '';
}

function behaviorScripts(node: AnyNode, indent: string): string[] {
  if (!node.behaviors) return [];
  const out: string[] = [];
  for (const b of node.behaviors) {
    out.push(...behaviorScript(b, classFor(node), indent));
  }
  return out;
}

function behaviorScript(b: Behavior, scope: string, indent: string): string[] {
  const src = typeof b.config?.['src'] === 'string' ? (b.config['src'] as string) : undefined;
  if (src !== undefined) {
    return [`${indent}<script data-vs-behavior="${escapeAttr(b.id)}" data-vs-scope="#${scope}" src="${escapeAttr(src)}"></script>`];
  }
  if (b.script === undefined || b.script.startsWith('/* external */')) return [];
  return [
    `${indent}<script data-vs-behavior="${escapeAttr(b.id)}" data-vs-scope="#${scope}">`,
    b.script.replace(/<\/script/gi, '<\\/script'),
    `${indent}</script>`,
  ];
}

function generateHtml(tree: WidgetTree, css: string, options: GenerateOptions): string {
  const page = tree.root;
  const lines: string[] = [];
  for (const section of page.children) {
    lines.push(...sectionHtml(section, '    '));
  }
  lines.push(...behaviorScripts(page, '    '));

  const head = [
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(page.title)}</title>`,
    options.cssHref !== undefined
      ? `  <link rel="stylesheet" href="${escapeAttr(options.cssHref)}">`
      : `  <style>\n${css}  </style>`,
  ];

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    ...head,
    '</head>',
    `<body class="${classFor(page)}"${idAttrFor(page)}>`,
    ...lines,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function sectionHtml(section: SectionNode, indent: string): string[] {
  const original = section.meta.originalElement?.tagName;
  const tag = original !== undefined && SEMANTIC_SECTION_TAGS.has(original) ? original : 'section';
  const lines = [`${indent}<${tag} class="${classFor(section)}"${idAttrFor(section)}>`];
  for (const row of section.children) {
    lines.push(...rowHtml(row, indent + '  '));
  }
  lines.push(...behaviorScripts(section, indent + '  '));
  lines.push(`${indent}</${tag}>`);
  return lines;
}

function rowHtml(row: RowNode, indent: string): string[] {
  const lines = [`${indent}<div class="${classFor(row)}"${idAttrFor(row)}>`];
  for (const column of row.children) {
    lines.push(...columnHtml(column, indent + '  '));
  }
  lines.push(...behaviorScripts(row, indent + '  '));
  lines.push(`${indent}</div>`);
  return lines;
}

function columnHtml(column: ColumnNode, indent: string): string[] {
  const lines = [`${indent}<div class="${classFor(column)}"${idAttrFor(column)}>`];
  for (const widget of column.children) {
    lines.push(...widgetHtml(widget, indent + '  '));
  }
  lines.push(...behaviorScripts(column, indent + '  '));
  lines.push(`${indent}</div>`);
  return lines;
}

function widgetHtml(widget: WidgetNode, indent: string): string[] {
  const cls = classFor(widget);
  const id = idAttrFor(widget);
  const rawId = widget.behaviors && widget.behaviors.length > 0 ? classFor(widget) : undefined;
  const scripts = behaviorScripts(widget, indent);

  switch (widget.widgetType) {
    case 'heading': {
      const props = widget.props as HeadingWidgetProps;
      const tag = `h${props.level}`;
      return [`${indent}<${tag} class="${cls}"${id}>${escapeHtml(props.content)}</${tag}>`, ...scripts];
    }
    case 'text': {
      const props = widget.props as TextWidgetProps;
      const original = widget.meta.originalElement?.tagName;
      const tag = original !== undefined && TEXT_WRAPPER_TAGS.has(original) ? original : 'div';
      return [`${indent}<${tag} class="${cls}"${id}>${props.content}</${tag}>`, ...scripts];
    }
    case 'image': {
      const props = widget.props as ImageWidgetProps;
      const attrs = attrsString({
        src: props.src,
        alt: props.alt,
        ...(props.width !== undefined ? { width: String(props.width) } : {}),
        ...(props.height !== undefined ? { height: String(props.height) } : {}),
        ...(props.loading !== undefined ? { loading: props.loading } : {}),
      });
      return [`${indent}<img class="${cls}"${id}${attrs}>`, ...scripts];
    }
    case 'button': {
      const props = widget.props as ButtonWidgetProps;
      const original = widget.meta.originalElement?.tagName;
      const aria = props.ariaLabel !== undefined ? { 'aria-label': props.ariaLabel } : {};
      if (original === 'button') {
        return [`${indent}<button class="${cls}"${id}${attrsString(aria)}>${escapeHtml(props.text)}</button>`, ...scripts];
      }
      const attrs = attrsString({
        href: props.href ?? '#',
        ...(props.target === '_blank' ? { target: '_blank', rel: 'noopener' } : {}),
        ...aria,
      });
      return [`${indent}<a class="${cls}"${id}${attrs}>${escapeHtml(props.text)}</a>`, ...scripts];
    }
    case 'icon': {
      const props = widget.props as IconWidgetProps;
      if (props.svg !== undefined) {
        return [`${indent}${injectClass(props.svg, cls, rawId)}`, ...scripts];
      }
      const iconClasses = props.icon
        .split(/\s+/)
        .filter((c) => /^[\w:-]+$/.test(c))
        .join(' ');
      const aria = props.ariaLabel !== undefined
        ? ` role="img" aria-label="${escapeAttr(props.ariaLabel)}"`
        : ' aria-hidden="true"';
      return [`${indent}<span class="${iconClasses}${iconClasses ? ' ' : ''}${cls}"${id}${aria}></span>`, ...scripts];
    }
    case 'list': {
      const props = widget.props as ListWidgetProps;
      const tag = props.ordered ? 'ol' : 'ul';
      return [
        `${indent}<${tag} class="${cls}"${id}>`,
        ...props.items.map((item) => `${indent}  <li>${item.content}</li>`),
        `${indent}</${tag}>`,
        ...scripts,
      ];
    }
    case 'video': {
      const props = widget.props as VideoWidgetProps;
      const bools = [
        props.controls === true ? 'controls' : undefined,
        props.autoplay === true ? 'autoplay' : undefined,
        props.loop === true ? 'loop' : undefined,
        props.muted === true ? 'muted' : undefined,
      ].filter((b): b is string => b !== undefined);
      const attrs = attrsString({
        src: props.src,
        ...(props.poster !== undefined ? { poster: props.poster } : {}),
        ...(props.width !== undefined ? { width: String(props.width) } : {}),
        ...(props.height !== undefined ? { height: String(props.height) } : {}),
      });
      const boolStr = bools.length > 0 ? ' ' + bools.join(' ') : '';
      return [`${indent}<video class="${cls}"${id}${attrs}${boolStr}></video>`, ...scripts];
    }
    case 'embed': {
      const props = widget.props as EmbedWidgetProps;
      return [`${indent}${injectClass(props.html, cls, rawId)}`, ...scripts];
    }
    case 'custom-html': {
      const props = widget.props as CustomHtmlWidgetProps;
      return [`${indent}${injectClass(props.html, cls, rawId)}`, ...scripts];
    }
  }
}
