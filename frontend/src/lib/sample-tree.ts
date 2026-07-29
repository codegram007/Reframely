import type { NodeMeta, WidgetTree } from '@/lib/schema';

const now = '2026-07-21T00:00:00.000Z';
const meta = (extra: Partial<NodeMeta> = {}): NodeMeta => ({
  source: 'imported',
  createdAt: now,
  updatedAt: now,
  ...extra,
});

/**
 * A self-contained SVG placeholder as a data URL — renders in the
 * sandboxed canvas iframe with no network dependency, and is same-origin
 * so the cropper's canvas export stays untainted.
 */
const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6d5efc"/>
          <stop offset="1" stop-color="#a855f7"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#g)"/>
      <circle cx="620" cy="120" r="90" fill="#ffffff" opacity="0.15"/>
      <circle cx="180" cy="400" r="130" fill="#ffffff" opacity="0.1"/>
      <text x="400" y="260" font-family="Inter, sans-serif" font-size="42" font-weight="700"
        fill="#ffffff" text-anchor="middle">Sample image</text>
      <text x="400" y="300" font-family="Inter, sans-serif" font-size="18"
        fill="#ffffff" opacity="0.8" text-anchor="middle">800 × 500 — replace or crop me</text>
    </svg>`,
  );

/**
 * A hand-authored sample page used to render the canvas until a real
 * tree-fetch API exists. Exercises a spread of widget types (heading,
 * text, button, image, list, icon) plus token references, responsive
 * overrides, and a multi-column feature row — enough to demonstrate
 * rendering, hover, selection, and bbox reporting end-to-end.
 */
export const sampleTree: WidgetTree = {
  schemaVersion: 1,
  tokens: {
    colors: [
      { id: 'color-accent', name: 'Accent', value: '#6d5efc' },
      { id: 'color-ink', name: 'Ink', value: '#0b0d17' },
      { id: 'color-slate', name: 'Slate', value: '#5b6070' },
    ],
    typography: [],
  },
  root: {
    id: 'page',
    type: 'page',
    title: 'Acme — Sample import',
    styles: { desktop: { fontFamily: 'Inter, system-ui, sans-serif', color: { type: 'token', tokenId: 'color-ink' } } },
    meta: meta(),
    children: [
      // ---- Hero ----------------------------------------------------------
      {
        id: 'sec-hero',
        type: 'section',
        name: 'Hero',
        meta: meta({ originalElement: { tagName: 'header', selector: 'header.hero' } }),
        styles: {
          desktop: {
            paddingTop: 96,
            paddingBottom: 96,
            paddingLeft: 32,
            paddingRight: 32,
            backgroundColor: { type: 'token', tokenId: 'color-ink' },
            color: '#ffffff',
            textAlign: 'center',
          },
          mobile: { paddingTop: 56, paddingBottom: 56, paddingLeft: 20, paddingRight: 20 },
        },
        children: [
          {
            id: 'row-hero',
            type: 'row',
            meta: meta(),
            styles: { desktop: {} },
            children: [
              {
                id: 'col-hero',
                type: 'column',
                span: 12,
                meta: meta(),
                styles: { desktop: {} },
                children: [
                  {
                    id: 'w-hero-h1',
                    type: 'widget',
                    widgetType: 'heading',
                    props: { content: 'Ship faster with Acme', level: 1 },
                    meta: meta({ originalElement: { tagName: 'h1' } }),
                    styles: { desktop: { fontSize: 44, fontWeight: 700, marginBottom: 16 }, mobile: { fontSize: 30 } },
                  },
                  {
                    id: 'w-hero-p',
                    type: 'widget',
                    widgetType: 'text',
                    props: { content: 'The all-in-one toolkit for small teams that move quickly.' },
                    meta: meta({ originalElement: { tagName: 'p' } }),
                    styles: { desktop: { fontSize: 18, marginBottom: 28, color: '#c7cad6' } },
                  },
                  {
                    id: 'w-hero-cta',
                    type: 'widget',
                    widgetType: 'button',
                    props: { text: 'Get started', href: '#features' },
                    meta: meta({ originalElement: { tagName: 'a' } }),
                    styles: {
                      desktop: {
                        display: 'inline-block',
                        backgroundColor: { type: 'token', tokenId: 'color-accent' },
                        color: '#ffffff',
                        paddingTop: 12,
                        paddingBottom: 12,
                        paddingLeft: 28,
                        paddingRight: 28,
                        borderRadius: 8,
                        fontWeight: 600,
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      // ---- Features (3 columns) -----------------------------------------
      {
        id: 'sec-features',
        type: 'section',
        name: 'Features',
        meta: meta({ originalElement: { tagName: 'section', selector: 'section.features' } }),
        styles: { desktop: { paddingTop: 64, paddingBottom: 64, paddingLeft: 32, paddingRight: 32 } },
        children: [
          {
            id: 'row-features',
            type: 'row',
            meta: meta({ originalElement: { tagName: 'div', selector: 'div.features' } }),
            styles: {
              desktop: { display: 'flex', flexDirection: 'row', gap: 24 },
              mobile: { flexDirection: 'column' },
            },
            children: (['Fast', 'Simple', 'Secure'] as const).map((title, i) => ({
              id: `col-feat-${i + 1}`,
              type: 'column' as const,
              span: 4,
              meta: meta({ originalElement: { tagName: 'div', className: 'card' } }),
              styles: {
                desktop: {
                  flexGrow: 1,
                  flexBasis: 0,
                  paddingTop: 24,
                  paddingBottom: 24,
                  paddingLeft: 24,
                  paddingRight: 24,
                  borderWidth: 1,
                  borderStyle: 'solid' as const,
                  borderColor: '#e2e2e8',
                  borderRadius: 12,
                },
              },
              children: [
                {
                  id: `w-feat-h-${i + 1}`,
                  type: 'widget' as const,
                  widgetType: 'heading' as const,
                  props: { content: title, level: 3 as const },
                  meta: meta({ originalElement: { tagName: 'h3' } }),
                  styles: { desktop: { fontSize: 19, fontWeight: 600, marginBottom: 8 } },
                },
                {
                  id: `w-feat-p-${i + 1}`,
                  type: 'widget' as const,
                  widgetType: 'text' as const,
                  props: {
                    content: [
                      'Millisecond builds, every time.',
                      'One config file. No surprises.',
                      'Audited and encrypted by default.',
                    ][i]!,
                  },
                  meta: meta({ originalElement: { tagName: 'p' } }),
                  styles: { desktop: { color: { type: 'token', tokenId: 'color-slate' } } },
                },
              ],
            })),
          },
        ],
      },
      // ---- Showcase (image) ---------------------------------------------
      {
        id: 'sec-showcase',
        type: 'section',
        name: 'Showcase',
        meta: meta({ originalElement: { tagName: 'section', selector: 'section.showcase' } }),
        styles: {
          desktop: {
            paddingTop: 48,
            paddingBottom: 48,
            paddingLeft: 32,
            paddingRight: 32,
            backgroundColor: '#f4f4f8',
            textAlign: 'center',
          },
        },
        children: [
          {
            id: 'row-showcase',
            type: 'row',
            meta: meta(),
            styles: { desktop: {} },
            children: [
              {
                id: 'col-showcase',
                type: 'column',
                span: 12,
                meta: meta(),
                styles: { desktop: {} },
                children: [
                  {
                    id: 'w-showcase-img',
                    type: 'widget',
                    widgetType: 'image',
                    props: {
                      src: PLACEHOLDER_IMAGE,
                      alt: 'Product screenshot placeholder',
                      width: 800,
                      height: 500,
                    },
                    meta: meta({ originalElement: { tagName: 'img' } }),
                    styles: { desktop: { borderRadius: 12, maxWidth: 640 } },
                  },
                ],
              },
            ],
          },
        ],
      },
      // ---- Footer --------------------------------------------------------
      {
        id: 'sec-footer',
        type: 'section',
        name: 'Footer',
        meta: meta({ originalElement: { tagName: 'footer' } }),
        styles: {
          desktop: {
            paddingTop: 32,
            paddingBottom: 32,
            paddingLeft: 32,
            paddingRight: 32,
            backgroundColor: { type: 'token', tokenId: 'color-ink' },
            color: '#8b90a0',
            textAlign: 'center',
          },
        },
        children: [
          {
            id: 'row-footer',
            type: 'row',
            meta: meta(),
            styles: { desktop: {} },
            children: [
              {
                id: 'col-footer',
                type: 'column',
                span: 12,
                meta: meta(),
                styles: { desktop: {} },
                children: [
                  {
                    id: 'w-footer-text',
                    type: 'widget',
                    widgetType: 'text',
                    props: { content: '© 2026 Acme Inc.' },
                    meta: meta({ originalElement: { tagName: 'p' } }),
                    styles: { desktop: { fontSize: 13 } },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};
