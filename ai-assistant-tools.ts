/**
 * AI Assistant Tool Schema for Reframely
 *
 * Composable tool-calling API for Claude to propose edits to the widget tree.
 * Every tool call produces a diff/patch object shown to the user before commit.
 */

import type {
  NodeId,
  Breakpoint,
  WidgetType,
  WidgetProps,
  NodeStyles,
  Behavior,
  ColorToken,
  TypographyToken,
  TreeNode,
} from './widget-tree-schema';

// ============================================================================
// Patch/Diff Object Structure
// ============================================================================

export type PatchOperation =
  | { op: 'update_props'; nodeId: NodeId; props: Partial<WidgetProps> }
  | { op: 'update_styles'; nodeId: NodeId; breakpoint: Breakpoint; styles: Partial<NodeStyles> }
  | { op: 'insert_node'; parentId: NodeId; position: number; node: TreeNode }
  | { op: 'move_node'; nodeId: NodeId; newParentId: NodeId; position: number }
  | { op: 'delete_node'; nodeId: NodeId }
  | { op: 'duplicate_node'; nodeId: NodeId; newParentId?: NodeId; position?: number }
  | { op: 'add_behavior'; nodeId: NodeId; behavior: Behavior }
  | { op: 'remove_behavior'; nodeId: NodeId; behaviorId: string }
  | { op: 'set_color_token'; tokenId: string; value: string }
  | { op: 'set_typography_token'; tokenId: string; value: Partial<TypographyToken> }
  | { op: 'batch'; operations: PatchOperation[] };

export interface TreePatch {
  /** Unique patch ID for tracking/undo */
  patchId: string;

  /** Timestamp */
  createdAt: string;

  /** Operations to apply */
  operations: PatchOperation[];

  /** AI confidence in this patch (0-1) */
  confidence: number;

  /** Human-readable explanation of what this patch does and why */
  rationale: string;

  /** Which nodes will be affected (for preview highlighting) */
  affectedNodeIds: NodeId[];
}

// ============================================================================
// Anthropic API Tool Definitions
// ============================================================================

export const AI_ASSISTANT_TOOLS = [
  {
    name: 'get_node',
    description:
      'Retrieve a single node by ID. Use this to inspect current state before making edits. Single-node operation.',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The unique ID of the node to retrieve',
        },
      },
      required: ['nodeId'],
    },
  },

  {
    name: 'list_nodes',
    description:
      'Query nodes by type, widget type, or other criteria. Returns a list of matching node IDs with summary info. Tree-wide operation.',
    input_schema: {
      type: 'object',
      properties: {
        filters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['page', 'section', 'row', 'column', 'widget'],
              description: 'Filter by node type',
            },
            widgetType: {
              type: 'string',
              enum: ['text', 'heading', 'image', 'button', 'icon', 'list', 'video', 'embed', 'custom-html'],
              description: 'Filter by widget type (only applicable when type=widget)',
            },
            sectionName: {
              type: 'string',
              description: 'Filter sections by name (e.g., "Hero", "Pricing")',
            },
          },
        },
      },
      required: [],
    },
  },

  {
    name: 'update_props',
    description:
      'Update content properties of a widget (text, src, href, alt, etc.). Single-node operation. Produces a patch showing before/after.',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The widget node ID to update',
        },
        props: {
          type: 'object',
          description: 'Partial props object with fields to update (merged with existing props)',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this edit (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this change is needed and what it accomplishes',
        },
      },
      required: ['nodeId', 'props', 'confidence', 'rationale'],
    },
  },

  {
    name: 'update_styles',
    description:
      'Update styles for a node at a specific breakpoint (desktop/tablet/mobile). Single-node operation. Produces a patch showing before/after styles.',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The node ID to style',
        },
        breakpoint: {
          type: 'string',
          enum: ['desktop', 'tablet', 'mobile'],
          description: 'Which breakpoint to update',
        },
        styles: {
          type: 'object',
          description: 'Partial styles object (spacing, typography, colors, borders, layout, effects, position)',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this edit (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this style change is needed',
        },
      },
      required: ['nodeId', 'breakpoint', 'styles', 'confidence', 'rationale'],
    },
  },

  {
    name: 'update_styles_bulk',
    description:
      'Update styles across multiple nodes at once (e.g., "make all buttons larger"). Tree-wide operation. Produces a single patch with multiple style updates.',
    input_schema: {
      type: 'object',
      properties: {
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of node IDs to update',
        },
        breakpoint: {
          type: 'string',
          enum: ['desktop', 'tablet', 'mobile'],
          description: 'Which breakpoint to update',
        },
        styles: {
          type: 'object',
          description: 'Styles to apply to all selected nodes',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this edit (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this change affects multiple nodes and what it accomplishes',
        },
      },
      required: ['nodeIds', 'breakpoint', 'styles', 'confidence', 'rationale'],
    },
  },

  {
    name: 'insert_node',
    description:
      'Insert a new node (section, row, column, or widget) at a specific position within a parent. Single-node operation (though it affects tree structure).',
    input_schema: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description: 'The parent node ID where the new node will be inserted',
        },
        position: {
          type: 'number',
          description: "Zero-indexed position in the parent's children array",
        },
        nodeType: {
          type: 'string',
          enum: ['section', 'row', 'column', 'widget'],
          description: 'Type of node to create',
        },
        widgetType: {
          type: 'string',
          enum: ['text', 'heading', 'image', 'button', 'icon', 'list', 'video', 'embed', 'custom-html'],
          description: 'Widget type (required if nodeType=widget)',
        },
        props: {
          type: 'object',
          description: 'Initial props for the new node (required for widgets)',
        },
        styles: {
          type: 'object',
          description: 'Initial desktop styles (optional, will use defaults if omitted)',
        },
        name: {
          type: 'string',
          description: 'Name for the node (e.g., section name like "Testimonials")',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this insertion (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this node is being added and what it will contain',
        },
      },
      required: ['parentId', 'position', 'nodeType', 'confidence', 'rationale'],
    },
  },

  {
    name: 'move_node',
    description:
      'Move an existing node to a new parent and position (for reordering or restructuring). Single-node operation.',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The node ID to move',
        },
        newParentId: {
          type: 'string',
          description: 'The new parent node ID',
        },
        position: {
          type: 'number',
          description: "Zero-indexed position in the new parent's children array",
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this move (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this node is being moved',
        },
      },
      required: ['nodeId', 'newParentId', 'position', 'confidence', 'rationale'],
    },
  },

  {
    name: 'delete_node',
    description:
      'Delete a node and all its children. Single-node operation (but affects subtree).',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The node ID to delete',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this deletion (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this node should be removed',
        },
      },
      required: ['nodeId', 'confidence', 'rationale'],
    },
  },

  {
    name: 'duplicate_node',
    description:
      'Duplicate a node (and its subtree) to a new parent and position. Single-node operation (creates a copy).',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The node ID to duplicate',
        },
        newParentId: {
          type: 'string',
          description: 'The parent for the duplicated node (optional, defaults to same parent as original)',
        },
        position: {
          type: 'number',
          description: "Position in the parent's children array (optional, defaults to after original)",
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this duplication (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this node is being duplicated',
        },
      },
      required: ['nodeId', 'confidence', 'rationale'],
    },
  },

  {
    name: 'set_color_token',
    description:
      'Create or update a global color token. Tree-wide operation: all nodes referencing this token will automatically reflect the change.',
    input_schema: {
      type: 'object',
      properties: {
        tokenId: {
          type: 'string',
          description: 'Unique token ID (e.g., "primary", "accent", "text-dark")',
        },
        name: {
          type: 'string',
          description: 'Human-readable name (e.g., "Primary Brand Color")',
        },
        value: {
          type: 'string',
          description: 'Color value (hex, rgb, hsl)',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this token change (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this token is being set/changed and what it affects',
        },
      },
      required: ['tokenId', 'name', 'value', 'confidence', 'rationale'],
    },
  },

  {
    name: 'set_typography_token',
    description:
      'Create or update a global typography token. Tree-wide operation: all nodes referencing this token will automatically reflect the change.',
    input_schema: {
      type: 'object',
      properties: {
        tokenId: {
          type: 'string',
          description: 'Unique token ID (e.g., "heading-large", "body-text")',
        },
        name: {
          type: 'string',
          description: 'Human-readable name (e.g., "Heading Large")',
        },
        fontFamily: {
          type: 'string',
          description: 'Font family',
        },
        fontSize: {
          type: 'string',
          description: 'Font size (e.g., "24px", "1.5rem")',
        },
        fontWeight: {
          type: 'number',
          description: 'Font weight (100-900)',
        },
        lineHeight: {
          type: 'number',
          description: 'Line height (unitless multiplier, e.g., 1.5)',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in this token change (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this typography token is being set/changed and what it affects',
        },
      },
      required: ['tokenId', 'name', 'confidence', 'rationale'],
    },
  },

  {
    name: 'add_behavior',
    description:
      'Attach an interactive behavior (accordion, tabs, carousel, etc.) to a section or widget. Single-node operation.',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The node ID to attach the behavior to',
        },
        behavior: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['accordion', 'tabs', 'carousel', 'toggle', 'modal', 'dropdown', 'scroll-trigger', 'custom'],
              description: 'Behavior type',
            },
            config: {
              type: 'object',
              description: 'Behavior configuration (varies by type)',
            },
            affectedNodeIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Child node IDs this behavior controls',
            },
          },
          required: ['type'],
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Your confidence in adding this behavior (0-1)',
        },
        rationale: {
          type: 'string',
          description: 'Explain why this behavior is being added and how it will work',
        },
      },
      required: ['nodeId', 'behavior', 'confidence', 'rationale'],
    },
  },
] as const;

// ============================================================================
// Tool Categorization
// ============================================================================

/**
 * TOOL SCOPE REFERENCE:
 *
 * Single-node operations (affect one node):
 * - get_node
 * - update_props
 * - update_styles
 * - insert_node (creates one node)
 * - move_node
 * - delete_node (but affects subtree)
 * - duplicate_node
 * - add_behavior
 *
 * Tree-wide operations (affect multiple nodes or global state):
 * - list_nodes (queries entire tree)
 * - update_styles_bulk (updates multiple nodes)
 * - set_color_token (affects all nodes referencing the token)
 * - set_typography_token (affects all nodes referencing the token)
 */
