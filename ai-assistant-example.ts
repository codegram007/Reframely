/**
 * Worked Example: AI Assistant Tool Usage
 *
 * User request: "Add a testimonials section below the pricing table"
 *
 * This demonstrates the actual sequence of tool calls Claude would emit,
 * the patches produced, and how they compose into a preview.
 */

// ============================================================================
// Sample Widget Tree (Before)
// ============================================================================

const sampleTreeBefore = {
  schemaVersion: 1,
  tokens: {
    colors: [
      { id: 'primary', name: 'Primary', value: '#3B82F6' },
      { id: 'text-dark', name: 'Text Dark', value: '#1F2937' },
      { id: 'bg-light', name: 'Background Light', value: '#F9FAFB' },
    ],
    typography: [
      { id: 'heading-large', name: 'Heading Large', fontFamily: 'Inter', fontSize: '48px', fontWeight: 700, lineHeight: 1.2 },
      { id: 'body', name: 'Body Text', fontFamily: 'Inter', fontSize: '16px', fontWeight: 400, lineHeight: 1.6 },
    ],
  },
  root: {
    id: 'page-1',
    type: 'page',
    title: 'Landing Page',
    meta: {
      source: 'imported',
      createdAt: '2026-07-17T10:00:00Z',
      updatedAt: '2026-07-17T10:00:00Z',
    },
    styles: {
      desktop: {},
    },
    children: [
      {
        id: 'section-hero',
        type: 'section',
        name: 'Hero',
        meta: {
          source: 'imported',
          originalElement: { tagName: 'section', className: 'hero' },
          confidence: 0.95,
          createdAt: '2026-07-17T10:00:00Z',
          updatedAt: '2026-07-17T10:00:00Z',
        },
        styles: {
          desktop: {
            paddingTop: '80px',
            paddingBottom: '80px',
            backgroundColor: { type: 'token', tokenId: 'bg-light' },
          },
        },
        children: [
          // ... hero content (omitted for brevity)
        ],
      },
      {
        id: 'section-pricing',
        type: 'section',
        name: 'Pricing',
        meta: {
          source: 'imported',
          originalElement: { tagName: 'section', className: 'pricing' },
          confidence: 0.92,
          createdAt: '2026-07-17T10:00:00Z',
          updatedAt: '2026-07-17T10:00:00Z',
        },
        styles: {
          desktop: {
            paddingTop: '60px',
            paddingBottom: '60px',
            backgroundColor: '#FFFFFF',
          },
        },
        children: [
          {
            id: 'row-pricing-1',
            type: 'row',
            meta: { source: 'imported', createdAt: '2026-07-17T10:00:00Z', updatedAt: '2026-07-17T10:00:00Z' },
            styles: { desktop: { display: 'flex', gap: '32px', justifyContent: 'center' } },
            children: [
              {
                id: 'col-pricing-1',
                type: 'column',
                span: 4,
                meta: { source: 'imported', createdAt: '2026-07-17T10:00:00Z', updatedAt: '2026-07-17T10:00:00Z' },
                styles: { desktop: {} },
                children: [
                  {
                    id: 'widget-pricing-card-1',
                    type: 'widget',
                    widgetType: 'custom-html',
                    meta: { source: 'imported', createdAt: '2026-07-17T10:00:00Z', updatedAt: '2026-07-17T10:00:00Z' },
                    styles: { desktop: { padding: '24px', border: '1px solid #E5E7EB', borderRadius: '8px' } },
                    props: { html: '<h3>Starter</h3><p>$29/mo</p>' },
                  },
                ],
              },
              {
                id: 'col-pricing-2',
                type: 'column',
                span: 4,
                meta: { source: 'imported', createdAt: '2026-07-17T10:00:00Z', updatedAt: '2026-07-17T10:00:00Z' },
                styles: { desktop: {} },
                children: [
                  {
                    id: 'widget-pricing-card-2',
                    type: 'widget',
                    widgetType: 'custom-html',
                    meta: { source: 'imported', createdAt: '2026-07-17T10:00:00Z', updatedAt: '2026-07-17T10:00:00Z' },
                    styles: { desktop: { padding: '24px', border: '2px solid #3B82F6', borderRadius: '8px' } },
                    props: { html: '<h3>Pro</h3><p>$99/mo</p>' },
                  },
                ],
              },
              {
                id: 'col-pricing-3',
                type: 'column',
                span: 4,
                meta: { source: 'imported', createdAt: '2026-07-17T10:00:00Z', updatedAt: '2026-07-17T10:00:00Z' },
                styles: { desktop: {} },
                children: [
                  {
                    id: 'widget-pricing-card-3',
                    type: 'widget',
                    widgetType: 'custom-html',
                    meta: { source: 'imported', createdAt: '2026-07-17T10:00:00Z', updatedAt: '2026-07-17T10:00:00Z' },
                    styles: { desktop: { padding: '24px', border: '1px solid #E5E7EB', borderRadius: '8px' } },
                    props: { html: '<h3>Enterprise</h3><p>$299/mo</p>' },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'section-footer',
        type: 'section',
        name: 'Footer',
        meta: {
          source: 'imported',
          createdAt: '2026-07-17T10:00:00Z',
          updatedAt: '2026-07-17T10:00:00Z',
        },
        styles: {
          desktop: {
            paddingTop: '40px',
            paddingBottom: '40px',
            backgroundColor: '#111827',
            color: '#FFFFFF',
          },
        },
        children: [
          // ... footer content (omitted for brevity)
        ],
      },
    ],
  },
};

// ============================================================================
// Step 1: List Nodes to Find the Pricing Section
// ============================================================================

const toolCall1 = {
  name: 'list_nodes',
  input: {
    filters: {
      type: 'section',
      sectionName: 'Pricing',
    },
  },
};

// Response from list_nodes:
const toolResponse1 = {
  nodes: [
    {
      id: 'section-pricing',
      type: 'section',
      name: 'Pricing',
      position: 1, // Second child of page (index 1)
      parentId: 'page-1',
    },
  ],
};

// ============================================================================
// Step 2: Get the Page Node to Understand Structure
// ============================================================================

const toolCall2 = {
  name: 'get_node',
  input: {
    nodeId: 'page-1',
  },
};

// Response: (returns full page node with children array)
const toolResponse2 = {
  node: {
    id: 'page-1',
    type: 'page',
    children: [
      { id: 'section-hero', name: 'Hero' },
      { id: 'section-pricing', name: 'Pricing' },
      { id: 'section-footer', name: 'Footer' },
    ],
  },
};

// ============================================================================
// Step 3: Insert the Testimonials Section
// ============================================================================

const toolCall3 = {
  name: 'insert_node',
  input: {
    parentId: 'page-1',
    position: 2, // After pricing (index 1), before footer (index 2)
    nodeType: 'section',
    name: 'Testimonials',
    styles: {
      paddingTop: '80px',
      paddingBottom: '80px',
      backgroundColor: { type: 'token', tokenId: 'bg-light' },
    },
    confidence: 0.9,
    rationale:
      'Creating a new testimonials section between Pricing and Footer. Using the same vertical spacing (80px) and background token as the Hero section for visual consistency.',
  },
};

// Patch produced by tool call 3:
const patch1 = {
  patchId: 'patch-001',
  createdAt: '2026-07-17T14:23:45Z',
  operations: [
    {
      op: 'insert_node',
      parentId: 'page-1',
      position: 2,
      node: {
        id: 'section-testimonials', // Generated UUID
        type: 'section',
        name: 'Testimonials',
        meta: {
          source: 'ai-generated',
          createdAt: '2026-07-17T14:23:45Z',
          updatedAt: '2026-07-17T14:23:45Z',
        },
        styles: {
          desktop: {
            paddingTop: '80px',
            paddingBottom: '80px',
            backgroundColor: { type: 'token', tokenId: 'bg-light' },
          },
        },
        children: [], // Empty section (will add content next)
      },
    },
  ],
  confidence: 0.9,
  rationale:
    'Creating a new testimonials section between Pricing and Footer. Using the same vertical spacing (80px) and background token as the Hero section for visual consistency.',
  affectedNodeIds: ['page-1', 'section-testimonials'],
};

// ============================================================================
// Step 4: Add a Row to the Testimonials Section
// ============================================================================

const toolCall4 = {
  name: 'insert_node',
  input: {
    parentId: 'section-testimonials',
    position: 0,
    nodeType: 'row',
    styles: {
      display: 'flex',
      gap: '32px',
      justifyContent: 'center',
      maxWidth: '1200px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    confidence: 0.95,
    rationale:
      'Adding a centered row container for testimonial cards, matching the layout pattern used in the pricing section.',
  },
};

// Patch produced:
const patch2 = {
  patchId: 'patch-002',
  createdAt: '2026-07-17T14:23:46Z',
  operations: [
    {
      op: 'insert_node',
      parentId: 'section-testimonials',
      position: 0,
      node: {
        id: 'row-testimonials-1',
        type: 'row',
        meta: {
          source: 'ai-generated',
          createdAt: '2026-07-17T14:23:46Z',
          updatedAt: '2026-07-17T14:23:46Z',
        },
        styles: {
          desktop: {
            display: 'flex',
            gap: '32px',
            justifyContent: 'center',
            maxWidth: '1200px',
            marginLeft: 'auto',
            marginRight: 'auto',
          },
        },
        children: [],
      },
    },
  ],
  confidence: 0.95,
  rationale:
    'Adding a centered row container for testimonial cards, matching the layout pattern used in the pricing section.',
  affectedNodeIds: ['section-testimonials', 'row-testimonials-1'],
};

// ============================================================================
// Step 5: Add Three Testimonial Columns (Bulk Insert via Multiple Calls)
// ============================================================================

// Claude would make 3 insert_node calls, one for each column+widget pair.
// For brevity, showing one example:

const toolCall5 = {
  name: 'insert_node',
  input: {
    parentId: 'row-testimonials-1',
    position: 0,
    nodeType: 'column',
    styles: {
      flex: '1',
      minWidth: '280px',
    },
    confidence: 0.9,
    rationale: 'First of three testimonial columns, using flexible layout to adapt to screen size.',
  },
};

// ... then insert a text widget inside the column:

const toolCall6 = {
  name: 'insert_node',
  input: {
    parentId: 'col-testimonials-1', // ID from previous insert
    position: 0,
    nodeType: 'widget',
    widgetType: 'text',
    props: {
      content:
        '<blockquote>"Vibestudio transformed our workflow. We can now iterate on designs 10x faster."</blockquote><p><strong>Sarah Chen</strong>, Product Designer at Acme Corp</p>',
    },
    styles: {
      padding: '24px',
      backgroundColor: '#FFFFFF',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    confidence: 0.85,
    rationale:
      'Adding testimonial content with quote and attribution. Using card-style styling (white bg, shadow, rounded corners) consistent with the pricing cards.',
  },
};

// This pattern repeats for testimonials 2 and 3.

// Combined patch for all testimonial content:
const patch3 = {
  patchId: 'patch-003',
  createdAt: '2026-07-17T14:23:47Z',
  operations: [
    {
      op: 'insert_node',
      parentId: 'row-testimonials-1',
      position: 0,
      node: {
        id: 'col-testimonials-1',
        type: 'column',
        meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:47Z', updatedAt: '2026-07-17T14:23:47Z' },
        styles: { desktop: { flex: '1', minWidth: '280px' } },
        children: [
          {
            id: 'widget-testimonial-1',
            type: 'widget',
            widgetType: 'text',
            meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:47Z', updatedAt: '2026-07-17T14:23:47Z' },
            styles: {
              desktop: {
                padding: '24px',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              },
            },
            props: {
              content:
                '<blockquote>"Vibestudio transformed our workflow. We can now iterate on designs 10x faster."</blockquote><p><strong>Sarah Chen</strong>, Product Designer at Acme Corp</p>',
            },
          },
        ],
      },
    },
    {
      op: 'insert_node',
      parentId: 'row-testimonials-1',
      position: 1,
      node: {
        id: 'col-testimonials-2',
        type: 'column',
        meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:47Z', updatedAt: '2026-07-17T14:23:47Z' },
        styles: { desktop: { flex: '1', minWidth: '280px' } },
        children: [
          {
            id: 'widget-testimonial-2',
            type: 'widget',
            widgetType: 'text',
            meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:47Z', updatedAt: '2026-07-17T14:23:47Z' },
            styles: {
              desktop: {
                padding: '24px',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              },
            },
            props: {
              content:
                '<blockquote>"The import feature is magic. It understood our legacy site perfectly."</blockquote><p><strong>Marcus Johnson</strong>, CTO at BuildCo</p>',
            },
          },
        ],
      },
    },
    {
      op: 'insert_node',
      parentId: 'row-testimonials-1',
      position: 2,
      node: {
        id: 'col-testimonials-3',
        type: 'column',
        meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:47Z', updatedAt: '2026-07-17T14:23:47Z' },
        styles: { desktop: { flex: '1', minWidth: '280px' } },
        children: [
          {
            id: 'widget-testimonial-3',
            type: 'widget',
            widgetType: 'text',
            meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:47Z', updatedAt: '2026-07-17T14:23:47Z' },
            styles: {
              desktop: {
                padding: '24px',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              },
            },
            props: {
              content:
                '<blockquote>"Finally, a page builder that doesn\'t fight me. Clean exports, no bloat."</blockquote><p><strong>Emily Rodriguez</strong>, Freelance Developer</p>',
            },
          },
        ],
      },
    },
  ],
  confidence: 0.85,
  rationale:
    'Adding three testimonial cards in a flex row layout. Each card contains a quote and attribution, styled consistently with the pricing cards (white background, shadow, rounded corners). Flexible layout ensures responsive behavior.',
  affectedNodeIds: [
    'row-testimonials-1',
    'col-testimonials-1',
    'col-testimonials-2',
    'col-testimonials-3',
    'widget-testimonial-1',
    'widget-testimonial-2',
    'widget-testimonial-3',
  ],
};

// ============================================================================
// Step 6 (Optional): Add a Section Heading
// ============================================================================

const toolCall7 = {
  name: 'insert_node',
  input: {
    parentId: 'section-testimonials',
    position: 0, // Before the row (pushes row to position 1)
    nodeType: 'row',
    confidence: 0.9,
    rationale: 'Adding a row to hold the section heading, positioned above the testimonial cards.',
  },
};

const toolCall8 = {
  name: 'insert_node',
  input: {
    parentId: 'row-testimonials-heading', // ID from previous insert
    position: 0,
    nodeType: 'column',
    styles: {
      width: '100%',
    },
    confidence: 0.95,
    rationale: 'Full-width column for the section heading.',
  },
};

const toolCall9 = {
  name: 'insert_node',
  input: {
    parentId: 'col-testimonials-heading',
    position: 0,
    nodeType: 'widget',
    widgetType: 'heading',
    props: {
      content: 'What Our Users Say',
      level: 2,
    },
    styles: {
      fontSize: { type: 'token', tokenId: 'heading-large' },
      textAlign: 'center',
      marginBottom: '48px',
      color: { type: 'token', tokenId: 'text-dark' },
    },
    confidence: 0.95,
    rationale:
      'Adding a centered H2 heading above the testimonials, referencing global typography and color tokens for consistency with the rest of the page.',
  },
};

// Combined patch:
const patch4 = {
  patchId: 'patch-004',
  createdAt: '2026-07-17T14:23:48Z',
  operations: [
    {
      op: 'insert_node',
      parentId: 'section-testimonials',
      position: 0,
      node: {
        id: 'row-testimonials-heading',
        type: 'row',
        meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:48Z', updatedAt: '2026-07-17T14:23:48Z' },
        styles: { desktop: {} },
        children: [
          {
            id: 'col-testimonials-heading',
            type: 'column',
            meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:48Z', updatedAt: '2026-07-17T14:23:48Z' },
            styles: { desktop: { width: '100%' } },
            children: [
              {
                id: 'widget-testimonials-heading',
                type: 'widget',
                widgetType: 'heading',
                meta: { source: 'ai-generated', createdAt: '2026-07-17T14:23:48Z', updatedAt: '2026-07-17T14:23:48Z' },
                styles: {
                  desktop: {
                    fontSize: { type: 'token', tokenId: 'heading-large' },
                    textAlign: 'center',
                    marginBottom: '48px',
                    color: { type: 'token', tokenId: 'text-dark' },
                  },
                },
                props: {
                  content: 'What Our Users Say',
                  level: 2,
                },
              },
            ],
          },
        ],
      },
    },
  ],
  confidence: 0.95,
  rationale:
    'Adding a centered H2 heading above the testimonials, referencing global typography and color tokens for consistency with the rest of the page.',
  affectedNodeIds: ['section-testimonials', 'row-testimonials-heading', 'col-testimonials-heading', 'widget-testimonials-heading'],
};

// ============================================================================
// Final Result: All Patches Combined
// ============================================================================

export const fullEditSequence = {
  userRequest: 'Add a testimonials section below the pricing table',
  toolCalls: [toolCall1, toolCall2, toolCall3, toolCall4, toolCall5, toolCall6, toolCall7, toolCall8, toolCall9],
  patches: [patch1, patch2, patch3, patch4],
  summary: {
    totalOperations: 6, // 1 section + 1 row + 1 heading row + 3 columns with widgets
    affectedNodes: 11,
    confidenceRange: [0.85, 0.95],
    estimatedRenderTime: '<100ms',
  },
  previewDescription:
    'A new "Testimonials" section will appear between Pricing and Footer, containing a centered heading "What Our Users Say" and three testimonial cards in a flexible row layout. The section uses the same spacing and background as the Hero section for visual consistency.',
};

// ============================================================================
// Example 2: Tree-Wide Edit
// ============================================================================

// User request: "Change the accent color across the site from blue to purple"

const treeWideToolCall = {
  name: 'set_color_token',
  input: {
    tokenId: 'primary',
    name: 'Primary',
    value: '#9333EA', // Purple instead of blue
    confidence: 0.98,
    rationale:
      'Updating the primary color token from blue (#3B82F6) to purple (#9333EA). This will automatically update all nodes that reference this token, including buttons, borders, and accent elements throughout the page. Tree-wide operation affecting approximately 8 nodes.',
  },
};

const treeWidePatch = {
  patchId: 'patch-005',
  createdAt: '2026-07-17T14:30:00Z',
  operations: [
    {
      op: 'set_color_token',
      tokenId: 'primary',
      value: '#9333EA',
    },
  ],
  confidence: 0.98,
  rationale:
    'Updating the primary color token from blue (#3B82F6) to purple (#9333EA). This will automatically update all nodes that reference this token, including buttons, borders, and accent elements throughout the page. Tree-wide operation affecting approximately 8 nodes.',
  affectedNodeIds: [
    // All nodes referencing { type: 'token', tokenId: 'primary' }
    'widget-cta-button',
    'widget-pricing-card-2', // The highlighted Pro card
    'widget-link-1',
    'widget-link-2',
    // ... etc
  ],
};

/**
 * KEY INSIGHTS:
 *
 * 1. Composability: Simple operations (insert_node, update_styles) compose
 *    into complex edits without a monolithic "edit_tree" tool.
 *
 * 2. Tree-wide efficiency: set_color_token is ONE operation that affects
 *    N nodes, rather than N update_styles calls.
 *
 * 3. Preview-before-commit: Every patch includes confidence, rationale, and
 *    affected node IDs, giving the UI everything it needs to show a rich
 *    preview with inline diffs and explanations.
 *
 * 4. Rationale as context: The model explains WHY each edit is needed,
 *    surfacing decisions like "matching the pricing layout pattern" that
 *    help the user understand and trust the AI's choices.
 *
 * 5. Incremental complexity: Simple requests (change a color) → 1 tool call.
 *    Complex requests (add a section) → sequence of tool calls that build
 *    up the structure step by step, each with its own preview.
 */
