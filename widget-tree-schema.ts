/**
 * Reframely Widget Tree Schema
 * Version 1.0
 *
 * The single source of truth for the entire application.
 * Everything else (canvas, panels, codegen) derives from this structure.
 */

// ============================================================================
// Core Infrastructure
// ============================================================================

export type SchemaVersion = 1;

export type NodeId = string; // UUID v4

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export interface TokenReference {
  type: 'token';
  tokenId: string;
}

export type StyleValue = string | number | TokenReference;

// ============================================================================
// Node Types
// ============================================================================

export type NodeType = 'page' | 'section' | 'row' | 'column' | 'widget';

export type WidgetType =
  | 'text'
  | 'heading'
  | 'image'
  | 'button'
  | 'icon'
  | 'list'
  | 'video'
  | 'embed'
  | 'custom-html';

// ============================================================================
// Provenance & Metadata
// ============================================================================

export interface NodeMeta {
  /** How this node was created */
  source: 'imported' | 'manual' | 'ai-generated';

  /** For imported nodes: original element info */
  originalElement?: {
    tagName: string;
    className?: string;
    selector?: string;
  };

  /** Classifier confidence (0-1) for imported nodes */
  confidence?: number;

  /** Human-readable notes */
  notes?: string;

  /** Creation timestamp */
  createdAt: string; // ISO 8601

  /** Last modified timestamp */
  updatedAt: string; // ISO 8601
}

// ============================================================================
// Styles (Responsive)
// ============================================================================

export interface SpacingStyles {
  marginTop?: StyleValue;
  marginRight?: StyleValue;
  marginBottom?: StyleValue;
  marginLeft?: StyleValue;
  paddingTop?: StyleValue;
  paddingRight?: StyleValue;
  paddingBottom?: StyleValue;
  paddingLeft?: StyleValue;
}

export interface TypographyStyles {
  fontFamily?: StyleValue;
  fontSize?: StyleValue;
  fontWeight?: StyleValue;
  lineHeight?: StyleValue;
  letterSpacing?: StyleValue;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
  fontStyle?: 'normal' | 'italic';
  /** CSS list-style-type for list widgets (e.g. 'none', 'disc'). */
  listStyleType?: string;
}

export interface ColorStyles {
  color?: StyleValue;
  backgroundColor?: StyleValue;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
}

export interface BorderStyles {
  borderWidth?: StyleValue;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
  borderColor?: StyleValue;
  borderRadius?: StyleValue;
  /** Per-side widths, used when the sides differ (e.g. a bottom divider). */
  borderTopWidth?: StyleValue;
  borderRightWidth?: StyleValue;
  borderBottomWidth?: StyleValue;
  borderLeftWidth?: StyleValue;
}

export interface LayoutStyles {
  display?: 'block' | 'flex' | 'grid' | 'inline-block' | 'none';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  /** Flex-item sizing (needed to reproduce equal-width imported columns). */
  flexGrow?: StyleValue;
  flexShrink?: StyleValue;
  flexBasis?: StyleValue;
  /** CSS flex `order` — used for per-breakpoint visual reordering. */
  order?: number;
  boxSizing?: 'content-box' | 'border-box';
  gap?: StyleValue;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  width?: StyleValue;
  height?: StyleValue;
  minWidth?: StyleValue;
  maxWidth?: StyleValue;
  minHeight?: StyleValue;
  maxHeight?: StyleValue;
}

export interface EffectStyles {
  boxShadow?: string;
  opacity?: number;
  transform?: string;
  transition?: string;
}

export interface PositionStyles {
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  top?: StyleValue;
  right?: StyleValue;
  bottom?: StyleValue;
  left?: StyleValue;
  zIndex?: number;
}

export interface NodeStyles
  extends SpacingStyles,
          TypographyStyles,
          ColorStyles,
          BorderStyles,
          LayoutStyles,
          EffectStyles,
          PositionStyles {
  /** Visibility per breakpoint */
  visible?: boolean;
}

/** Responsive styles: desktop is base, tablet/mobile are overrides */
export interface ResponsiveStyles {
  desktop: NodeStyles;
  tablet?: Partial<NodeStyles>;
  mobile?: Partial<NodeStyles>;
}

// ============================================================================
// Behaviors (Preserved Interactivity)
// ============================================================================

export interface Behavior {
  /** Unique behavior ID */
  id: string;

  /** Behavior type */
  type: 'accordion' | 'tabs' | 'carousel' | 'toggle' | 'modal' | 'dropdown' | 'scroll-trigger' | 'custom';

  /** Original script/event handler (preserved as-is) */
  script?: string;

  /** Config extracted from data attributes */
  config?: Record<string, unknown>;

  /** Which child nodes this behavior affects */
  affectedNodeIds?: NodeId[];
}

// ============================================================================
// Widget Props (Content)
// ============================================================================

export interface TextWidgetProps {
  content: string; // HTML string (rich text)
}

export interface HeadingWidgetProps {
  content: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface ImageWidgetProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}

export interface ButtonWidgetProps {
  text: string;
  href?: string;
  target?: '_self' | '_blank';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Accessible name when the visible text is not sufficient. */
  ariaLabel?: string;
}

export interface IconWidgetProps {
  icon: string; // Icon identifier (e.g., 'lucide:menu', 'fa:star')
  size?: number;
  /** Accessible name; decorative icons omit it and get aria-hidden. */
  ariaLabel?: string;
  /** Verbatim inline SVG markup for icon: 'inline-svg'. */
  svg?: string;
}

export interface ListWidgetProps {
  items: Array<{
    id: string;
    content: string;
  }>;
  ordered: boolean;
}

export interface VideoWidgetProps {
  src: string;
  poster?: string;
  width?: number;
  height?: number;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
}

export interface EmbedWidgetProps {
  html: string; // Iframe embed or raw HTML
  provider?: 'youtube' | 'vimeo' | 'twitter' | 'other';
}

export interface CustomHtmlWidgetProps {
  html: string;
  /** Reason this fell back to custom-html */
  fallbackReason?: string;
}

export type WidgetProps =
  | TextWidgetProps
  | HeadingWidgetProps
  | ImageWidgetProps
  | ButtonWidgetProps
  | IconWidgetProps
  | ListWidgetProps
  | VideoWidgetProps
  | EmbedWidgetProps
  | CustomHtmlWidgetProps;

// ============================================================================
// Node Definitions
// ============================================================================

interface BaseNode {
  id: NodeId;
  type: NodeType;
  styles: ResponsiveStyles;
  meta: NodeMeta;
  behaviors?: Behavior[];
}

export interface PageNode extends BaseNode {
  type: 'page';
  title: string;
  children: SectionNode[];
}

export interface SectionNode extends BaseNode {
  type: 'section';
  name?: string; // e.g., "Hero", "Pricing", "Footer"
  children: RowNode[];
}

export interface RowNode extends BaseNode {
  type: 'row';
  children: ColumnNode[];
}

export interface ColumnNode extends BaseNode {
  type: 'column';
  /** Column width (1-12 grid system, or 'auto') */
  span?: number | 'auto';
  children: WidgetNode[];
}

export interface WidgetNode extends BaseNode {
  type: 'widget';
  widgetType: WidgetType;
  props: WidgetProps;
}

export type TreeNode = PageNode | SectionNode | RowNode | ColumnNode | WidgetNode;

// ============================================================================
// Global Design Tokens
// ============================================================================

export interface ColorToken {
  id: string;
  name: string; // e.g., "Primary", "Accent", "Text Dark"
  value: string; // hex, rgb, hsl
}

export interface TypographyToken {
  id: string;
  name: string; // e.g., "Heading Large", "Body"
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
}

export interface GlobalTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
}

// ============================================================================
// Widget Tree (Root)
// ============================================================================

export interface WidgetTree {
  schemaVersion: SchemaVersion;
  tokens: GlobalTokens;
  root: PageNode;
}

// ============================================================================
// Migration Strategy
// ============================================================================

/**
 * MIGRATION STRATEGY (v1 → v2+):
 *
 * When schema changes, increment `schemaVersion` and add a migration function:
 *
 * ```ts
 * export function migrateV1toV2(tree: WidgetTreeV1): WidgetTreeV2 {
 *   // Transform old structure to new structure
 *   return { ...tree, schemaVersion: 2, newField: defaultValue };
 * }
 * ```
 *
 * The loader chain runs all migrations sequentially:
 * loadTree(json) → detectVersion → runMigrations → validate → return current version
 *
 * Expected migration triggers:
 * - Adding new widget types
 * - Adding new style properties (e.g., CSS Grid support)
 * - Changing behavior representation (if we switch from opaque scripts to semantic actions)
 * - Splitting tokens into more granular categories
 */
