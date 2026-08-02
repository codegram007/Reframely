# Reframely AI Assistant Tool Schema — Delivery Summary

## What was delivered

A complete tool-calling schema for the in-product AI assistant (Claude via Anthropic API) to propose edits to the Reframely widget tree.

## Files created

1. **[widget-tree-schema.ts](widget-tree-schema.ts)** — The complete widget tree schema (since it wasn't provided in your message)
   - Elementor-style hierarchy: Page → Sections → Rows → Columns → Widgets
   - Responsive styles (desktop/tablet/mobile breakpoints)
   - Global design tokens (colors, typography) with token references
   - Widget types: text, heading, image, button, icon, list, video, embed, custom-html
   - Provenance tracking (imported vs AI-generated vs manual)
   - Behavior preservation for interactive elements

2. **[ai-assistant-tools.ts](ai-assistant-tools.ts)** — The tool definitions and patch schema
   - **13 composable tools** (not one giant edit_tree tool):
     - **Query tools:** `get_node`, `list_nodes`
     - **Content tools:** `update_props`
     - **Style tools:** `update_styles` (single-node), `update_styles_bulk` (multi-node)
     - **Structure tools:** `insert_node`, `move_node`, `delete_node`, `duplicate_node`
     - **Token tools:** `set_color_token`, `set_typography_token` (tree-wide operations)
     - **Behavior tools:** `add_behavior`
   
   - **Patch/diff object structure:** Every tool call produces a `TreePatch` with:
     - `operations[]` — the reversible ops to apply
     - `confidence` (0-1) — model's confidence in the edit
     - `rationale` — human-readable explanation of why
     - `affectedNodeIds[]` — which nodes to highlight in preview
   
   - **Full Anthropic API tool definitions** (JSON format, ready to pass to the Messages API)

3. **[ai-assistant-example.ts](ai-assistant-example.ts)** — Worked examples showing:
   - **Example 1:** "Add a testimonials section below the pricing table"
     - Shows the full tool call sequence (9 calls total)
     - Shows the patches produced at each step
     - Demonstrates how the model builds structure incrementally
   
   - **Example 2:** "Change the accent color across the site from blue to purple"
     - Demonstrates a tree-wide operation (one `set_color_token` call affects N nodes)
     - Shows how token indirection enables efficient global edits

4. **[ai-assistant-design.md](ai-assistant-design.md)** — Design rationale document
   - Core decisions (composability, patch-based, confidence+rationale)
   - Single-node vs tree-wide tool categorization
   - Trade-offs and contentious decisions to revisit after real-world testing

## Key requirements met

✅ **Small set of composable tools** — 13 focused tools, each doing one thing

✅ **Tree-wide operations** — `set_color_token`, `set_typography_token`, `update_styles_bulk` all operate on multiple nodes in one call (not N individual updates)

✅ **Diff/patch objects** — Tools emit `TreePatch` objects, not direct mutations; the app applies patches through a reducer for atomic preview/apply/undo

✅ **Confidence + rationale** — Both are required fields on every mutating tool call; the UI can show "why this edit" and flag low-confidence proposals

✅ **Worked example** — Complete tool call sequence for "add a testimonials section", showing actual JSON tool calls and resulting patches against a sample tree

## Tool scope reference

**Single-node operations** (affect one node):
- `get_node`, `update_props`, `update_styles`, `insert_node`, `move_node`, `delete_node`, `duplicate_node`, `add_behavior`

**Tree-wide operations** (affect multiple nodes or global state):
- `list_nodes` (queries entire tree)
- `update_styles_bulk` (explicit set of nodes)
- `set_color_token`, `set_typography_token` (all nodes referencing the token)

## Usage with Anthropic API

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AI_ASSISTANT_TOOLS } from './ai-assistant-tools';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  tools: AI_ASSISTANT_TOOLS,
  messages: [
    {
      role: 'user',
      content: 'Add a testimonials section below the pricing table',
    },
  ],
});

// The model will return tool_use content blocks
// Extract the patches from the tool calls and show them in your preview UI
```

## Next steps (not implemented, out of scope)

- **Patch application reducer** — The function that takes a `TreePatch` and applies it to the tree state
- **Preview UI** — Canvas highlighting, side-by-side diff panel, confidence badges
- **Undo/redo stack** — Built on the patch history
- **Batch approval** — Let users accept/reject a logical group of patches, not just individual ones
- **System prompt** — Guidance for the model on when to use which tool, how to balance tokens vs one-off styles, etc.

## Notes

- The widget tree schema wasn't provided in your message (you wrote "[paste widget-tree-schema.ts contents or summary]"), so I designed one based on the PRD requirements. If you have an existing schema, reconcile the tool `input_schema` enum values and the `props`/`styles` shapes — the overall tool design holds regardless.

- All TypeScript syntax errors have been fixed (apostrophes in description strings are now properly escaped with double quotes).

- The schema is v1 and includes a migration strategy comment for future schema evolution.
