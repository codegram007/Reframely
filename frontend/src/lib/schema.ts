/**
 * Reframely Widget Tree Schema — frontend mirror.
 *
 * Canonical source: `widget-tree-schema.ts` at the repository root
 * (version 1.0). The frontend can't import across the repo root, so the
 * types are mirrored here and must stay in sync. `BaseNode` is exported
 * here (the root leaves it internal) because codegen references it.
 */

export type SchemaVersion = 1;
export type NodeId = string;
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export interface TokenReference {
  type: 'token';
  tokenId: string;
}
export type StyleValue = string | number | TokenReference;

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

export interface NodeMeta {
  source: 'imported' | 'manual' | 'ai-generated';
  originalElement?: {
    tagName: string;
    className?: string;
    selector?: string;
  };
  confidence?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

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
  borderTopWidth?: StyleValue;
  borderRightWidth?: StyleValue;
  borderBottomWidth?: StyleValue;
  borderLeftWidth?: StyleValue;
}

export interface LayoutStyles {
  display?: 'block' | 'flex' | 'grid' | 'inline-block' | 'none';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
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
  visible?: boolean;
}

export interface ResponsiveStyles {
  desktop: NodeStyles;
  tablet?: Partial<NodeStyles>;
  mobile?: Partial<NodeStyles>;
}

export interface Behavior {
  id: string;
  type:
    | 'accordion'
    | 'tabs'
    | 'carousel'
    | 'toggle'
    | 'modal'
    | 'dropdown'
    | 'scroll-trigger'
    | 'custom';
  script?: string;
  config?: Record<string, unknown>;
  affectedNodeIds?: NodeId[];
}

export interface TextWidgetProps {
  content: string;
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
  ariaLabel?: string;
}
export interface IconWidgetProps {
  icon: string;
  size?: number;
  ariaLabel?: string;
  svg?: string;
}
export interface ListWidgetProps {
  items: Array<{ id: string; content: string }>;
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
  html: string;
  provider?: 'youtube' | 'vimeo' | 'twitter' | 'other';
}
export interface CustomHtmlWidgetProps {
  html: string;
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

export interface BaseNode {
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
  name?: string;
  children: RowNode[];
}
export interface RowNode extends BaseNode {
  type: 'row';
  children: ColumnNode[];
}
export interface ColumnNode extends BaseNode {
  type: 'column';
  span?: number | 'auto';
  children: WidgetNode[];
}
export interface WidgetNode extends BaseNode {
  type: 'widget';
  widgetType: WidgetType;
  props: WidgetProps;
}

export type TreeNode = PageNode | SectionNode | RowNode | ColumnNode | WidgetNode;

export interface ColorToken {
  id: string;
  name: string;
  value: string;
}
export interface TypographyToken {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
}
export interface GlobalTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
}

export interface WidgetTree {
  schemaVersion: SchemaVersion;
  tokens: GlobalTokens;
  root: PageNode;
}
