# Vibestudio AI Assistant — Tool-Calling Design

## Note on the widget tree schema
Your message said "[paste widget-tree-schema.ts contents or summary]" but the actual
contents weren't included, so I built these tool definitions against the schema I
designed in the previous step ([widget-tree-schema.ts](widget-tree-schema.ts)). If your
real schema differs, the tool `input_schema` `enum`s and the `props`/`styles` shapes are
the parts to reconcile — the overall design holds regardless.

## Files
- [ai-assistant-tools.ts](ai-assistant-tools.ts) — Anthropic API tool definitions + patch object shape
- [ai-assistant-example.ts](ai-assistant-example.ts) — worked examples (add-a-section, tree-wide color change)

## Core design decisions

### 1. Composable tools, not one `edit_tree`
Each tool does one thing (`update_props`, `move_node`, `insert_node`…). Benefits:
- **Granular previews** — each operation maps to a discrete, reviewable diff.
- **Granular undo** — the patch stack is the undo stack.
- **Model clarity** — small, well-typed tools are easier for the model to use correctly than a single free-form endpoint that invites malformed tree blobs.

### 2. Single-node vs tree-wide (the scope requirement)
Explicitly categorized in the `TOOL SCOPE REFERENCE` block:
- **Single-node:** `get_node`, `update_props`, `update_styles`, `insert_node`, `move_node`, `delete_node`, `duplicate_node`, `add_behavior`
- **Tree-wide:** `list_nodes` (queries all), `update_styles_bulk` (N explicit nodes), `set_color_token` / `set_typography_token` (all token references)

"Change the accent color across the site" is **one** `set_color_token` call, not N `update_styles` calls — because widgets reference tokens by id, the change propagates automatically. This is the payoff of the token indirection in the widget schema.

### 3. Tools emit patches, not mutations
No tool mutates the tree directly. Each returns a `TreePatch`:

```ts
interface TreePatch {
  patchId: string;
  createdAt: string;
  operations: PatchOperation[];  // the reversible ops
  confidence: number;
  rationale: string;
  affectedNodeIds: NodeId[];     // for preview highlighting
}
```

The app applies patches through a single reducer. That gives us: preview-before-commit, atomic apply/reject, undo/redo, and a clean audit trail of AI-proposed changes.

### 4. Mandatory `confidence` + `rationale`
Both are `required` on every mutating tool. The model *must* explain itself, and the UI surfaces it ("Why this edit?"). Low-confidence patches can be visually flagged or gated behind explicit confirmation.

### 5. `affectedNodeIds` for preview UX
Every patch declares which nodes it touches so the canvas can highlight them and the diff panel can scope itself without re-diffing the whole tree.

## Contentious decisions / revisit after real-site testing

- **ID generation happens app-side, not model-side.** The model requests `insert_node`; the app assigns the UUID and returns it. This avoids the model inventing IDs that collide, but it means multi-step builds (insert column → insert widget into it) require the model to *learn the new id from the tool result* before the next call. The worked example shows this round-trip. If latency becomes a problem, we may let the model supply client-generated temp ids that the app rekeys on commit.

- **`insert_node` builds one node at a time.** Adding a testimonials section took ~6 calls. This is verbose but each step is independently previewable/reversible. A future `insert_subtree` tool could accept a whole subtree in one call for known patterns — at the cost of larger, harder-to-review diffs. Worth measuring which the model actually prefers against real requests.

- **`props` and `styles` are typed as generic `object` in the JSON tool schema.** The full discriminated union (per-widget props, per-category styles) is enormous and would bloat every tool definition, eating context and confusing the model. We validate the *structure* app-side against the TS types after the call. Trade-off: the model can propose a prop the widget doesn't support, and we reject it on validation. Acceptable, but we should watch the rejection rate.

- **No transactional guarantee across a tool sequence.** If the model inserts a section then fails partway through populating it, we can end up with an empty section pending review. Mitigation: group a logical request's patches under one preview and let the user accept/reject the batch, not individual patches. The `batch` PatchOperation exists for this.

- **`update_styles_bulk` vs `set_*_token`.** Both are tree-wide but semantically different: bulk is a one-off ("these 5 buttons"), tokens are durable ("the brand accent"). The model needs good guidance on when to reach for which — a bad instinct here produces either brittle one-offs or premature token proliferation. This is a system-prompt tuning problem more than a schema problem.

- **Behaviors are opaque to the model.** `add_behavior` lets the model attach a behavior descriptor but the schema deliberately doesn't let it author the `script`. Whether the model should ever *modify* preserved interactivity is an open question — for MVP it can only add declarative behavior types (accordion, tabs…), not touch imported scripts.
