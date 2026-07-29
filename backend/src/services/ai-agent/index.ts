/**
 * AI agent service (B12) — turns a user instruction + widget tree into
 * TreePatch proposals for preview-before-apply in the editor.
 *
 * When ANTHROPIC_API_KEY is set, this is the hook point for the Messages
 * API + AI_ASSISTANT_TOOLS. Until then (and in tests), a deterministic
 * heuristic proposer produces real TreePatch objects so the F17 UI can
 * run against the live backend without a model key.
 *
 * Owns: prompt assembly, patch construction.
 * Does NOT own: applying patches (editor commits via F15 undo path).
 */
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import type { TreePatch } from '../../lib/tree-patch.js';

export type { TreePatch } from '../../lib/tree-patch.js';

export interface AssistantRequest {
  projectId: string;
  treeVersionId?: string;
  userMessage: string;
  /** Current tree from the client (until versions are always loaded server-side). */
  tree?: unknown;
}

export interface AssistantResponse {
  patches: TreePatch[];
  assistantMessage: string;
}

export type AssistantErrorCode = 'EMPTY_MESSAGE' | 'INVALID_TREE';

export class AssistantError extends Error {
  constructor(
    readonly code: AssistantErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

export interface AiAgentServiceDeps {
  /** Optional override for tests. */
  propose?: (req: AssistantRequest) => Promise<AssistantResponse> | AssistantResponse;
  now?: () => Date;
  idFn?: () => string;
}

type TreeNode = {
  id: string;
  type: string;
  widgetType?: string;
  name?: string;
  props?: Record<string, unknown>;
  children?: TreeNode[];
  styles?: { desktop?: Record<string, unknown> };
  tokens?: never;
};

type WidgetTree = {
  tokens?: { colors?: Array<{ id: string; value: string }> };
  root: TreeNode;
};

function walk(node: TreeNode, visit: (n: TreeNode) => void): void {
  visit(node);
  for (const c of node.children ?? []) walk(c, visit);
}

function firstOf(
  tree: WidgetTree,
  pred: (n: TreeNode) => boolean,
): TreeNode | null {
  let found: TreeNode | null = null;
  walk(tree.root, (n) => {
    if (!found && pred(n)) found = n;
  });
  return found;
}

/**
 * Deterministic local proposer — mirrors the frontend mock so offline
 * demos and hermetic tests stay useful without Anthropic.
 */
export function proposeHeuristicPatches(
  tree: WidgetTree,
  userMessage: string,
  opts: { now?: () => Date; idFn?: () => string } = {},
): AssistantResponse {
  const now = opts.now ?? (() => new Date());
  const idFn = opts.idFn ?? (() => `pat_${randomUUID().replace(/-/g, '').slice(0, 10)}`);
  const msg = userMessage.trim();
  const lower = msg.toLowerCase();
  const createdAt = now().toISOString();

  // Accent / brand color
  if (
    /\b(accent|brand|primary)\b.*\b(color|colour|purple|blue|green|red|orange)\b|\b(make|change).*(purple|blue|green|teal|violet)\b/i.test(
      msg,
    )
  ) {
    let color = '#7c3aed';
    if (/\bblue\b/i.test(msg)) color = '#2563eb';
    else if (/\bgreen\b|\bteal\b/i.test(msg)) color = '#0d9488';
    else if (/\bred\b|\brose\b/i.test(msg)) color = '#e11d48';
    else if (/\borange\b/i.test(msg)) color = '#ea580c';
    const tokenId = tree.tokens?.colors?.[0]?.id ?? 'color-accent';
    const patch: TreePatch = {
      patchId: idFn(),
      createdAt,
      confidence: 0.92,
      rationale: `Update the site accent token so referencing widgets pick up ${color}.`,
      affectedNodeIds: [],
      operations: [{ op: 'set_color_token', tokenId, value: color }],
    };
    return {
      patches: [patch],
      assistantMessage: `I'll update the global accent token to ${color}. Review the preview, then Accept to apply.`,
    };
  }

  // Heading rewrite
  if (/\b(heading|title|headline|hero text)\b/i.test(msg) || /\bchange (the )?(text|copy)\b/i.test(msg)) {
    const heading = firstOf(tree, (n) => n.type === 'widget' && n.widgetType === 'heading');
    if (heading) {
      const quoted = msg.match(/["“](.+?)["”]/);
      const next =
        quoted?.[1] ??
        (lower.includes('welcome')
          ? 'Welcome to the next version of your site'
          : 'Ship beautiful pages, faster');
      const patch: TreePatch = {
        patchId: idFn(),
        createdAt,
        confidence: 0.88,
        rationale: `Rewrite the primary heading to: “${next}”.`,
        affectedNodeIds: [heading.id],
        operations: [
          {
            op: 'update_props',
            nodeId: heading.id,
            props: { content: next },
          },
        ],
      };
      return {
        patches: [patch],
        assistantMessage: `Proposed a new headline on “${heading.id}”. Accept to apply (undoable).`,
      };
    }
  }

  // Spacing
  if (/\b(spacing|padding|tighter|looser|compact)\b/i.test(msg)) {
    const section =
      firstOf(tree, (n) => n.type === 'section' && /hero|pricing|feature/i.test(n.name ?? '')) ??
      firstOf(tree, (n) => n.type === 'section');
    if (section) {
      const pad = lower.includes('tight') || lower.includes('compact') ? 48 : 120;
      const patch: TreePatch = {
        patchId: idFn(),
        createdAt,
        confidence: 0.8,
        rationale: `Adjust vertical padding on section “${section.name ?? section.id}”.`,
        affectedNodeIds: [section.id],
        operations: [
          {
            op: 'update_styles',
            nodeId: section.id,
            breakpoint: 'desktop',
            styles: { paddingTop: pad, paddingBottom: pad },
          },
        ],
      };
      return {
        patches: [patch],
        assistantMessage: 'Proposed a spacing tweak. Preview highlights the target section.',
      };
    }
  }

  // Default: soft style on first section or content note on first text
  const section = firstOf(tree, (n) => n.type === 'section');
  if (section) {
    const patch: TreePatch = {
      patchId: idFn(),
      createdAt,
      confidence: 0.7,
      rationale: 'Subtle accent wash on the first section to acknowledge your request.',
      affectedNodeIds: [section.id],
      operations: [
        {
          op: 'update_styles',
          nodeId: section.id,
          breakpoint: 'desktop',
          styles: { backgroundColor: 'rgba(109, 94, 252, 0.06)' },
        },
      ],
    };
    return {
      patches: [patch],
      assistantMessage:
        'Proposed a light style change. Connect ANTHROPIC_API_KEY for full natural-language editing.',
    };
  }

  return {
    patches: [],
    assistantMessage: 'I could not map that request onto the current tree. Try mentioning a heading, color, or section.',
  };
}

export class AiAgentService {
  private readonly proposeFn?: AiAgentServiceDeps['propose'];
  private readonly now: () => Date;
  private readonly idFn: () => string;

  constructor(deps: AiAgentServiceDeps = {}) {
    this.proposeFn = deps.propose;
    this.now = deps.now ?? (() => new Date());
    this.idFn = deps.idFn ?? (() => `pat_${randomUUID().replace(/-/g, '').slice(0, 10)}`);
  }

  async run(request: AssistantRequest): Promise<AssistantResponse> {
    const message = request.userMessage?.trim() ?? '';
    if (!message) {
      throw new AssistantError('EMPTY_MESSAGE', 'userMessage is required.');
    }

    if (this.proposeFn) {
      return this.proposeFn(request);
    }

    // Future: if (env.ANTHROPIC_API_KEY) return this.runAnthropic(request);

    const tree = request.tree as WidgetTree | undefined;
    if (!tree || typeof tree !== 'object' || !('root' in tree)) {
      throw new AssistantError(
        'INVALID_TREE',
        'Request body must include the current widget tree until server-side version load is wired.',
      );
    }

    return proposeHeuristicPatches(tree, message, { now: this.now, idFn: this.idFn });
  }
}

/** Expose whether a live model key is configured (for health/debug). */
export function aiAgentMode(): 'heuristic' | 'anthropic' {
  return env.ANTHROPIC_API_KEY ? 'anthropic' : 'heuristic';
}
