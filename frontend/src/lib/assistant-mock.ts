/**
 * Frontend-first mock for the AI Agent Service (B12).
 * Produces real TreePatch objects against the live sample/import tree so
 * the Accept/Reject preview UI is fully demoable offline.
 */
import type { TreeNode, WidgetTree } from './schema';
import type { TreePatch } from './tree-patch';
import { findNode } from './tree-index';

function walk(node: TreeNode, visit: (n: TreeNode) => void): void {
  visit(node);
  if (node.type !== 'widget') for (const c of node.children as TreeNode[]) walk(c, visit);
}

function firstOfType(tree: WidgetTree, type: TreeNode['type'], widgetType?: string): TreeNode | null {
  let found: TreeNode | null = null;
  walk(tree.root, (n) => {
    if (found) return;
    if (n.type !== type) return;
    if (widgetType && (n.type !== 'widget' || n.widgetType !== widgetType)) return;
    found = n;
  });
  return found;
}

function firstSectionNamed(tree: WidgetTree, re: RegExp): TreeNode | null {
  let found: TreeNode | null = null;
  walk(tree.root, (n) => {
    if (found || n.type !== 'section') return;
    const name = 'name' in n ? String(n.name ?? '') : '';
    if (re.test(name)) found = n;
  });
  return found;
}

function patchId(): string {
  return `pat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Build a demo patch from the user message + current tree. */
export function mockAssistantPatches(tree: WidgetTree, userMessage: string): {
  patches: TreePatch[];
  assistantMessage: string;
} {
  const msg = userMessage.trim();
  const lower = msg.toLowerCase();

  // Accent / brand color
  if (/\b(accent|brand|primary)\b.*\b(color|colour|purple|blue|green|red|orange)\b|\b(make|change).*(purple|blue|green|teal|violet)\b/i.test(msg)) {
    let color = '#7c3aed';
    if (/\bblue\b/i.test(msg)) color = '#2563eb';
    else if (/\bgreen\b|\bteal\b/i.test(msg)) color = '#0d9488';
    else if (/\bred\b|\brose\b/i.test(msg)) color = '#e11d48';
    else if (/\borange\b/i.test(msg)) color = '#ea580c';
    const tokenId = tree.tokens.colors[0]?.id ?? 'color-accent';
    const patch: TreePatch = {
      patchId: patchId(),
      createdAt: new Date().toISOString(),
      confidence: 0.92,
      rationale: `Update the site accent token so every widget referencing it (buttons, links, highlights) picks up ${color}.`,
      affectedNodeIds: [],
      operations: [{ op: 'set_color_token', tokenId, value: color }],
    };
    return {
      patches: [patch],
      assistantMessage: `I'll update the global accent token to ${color}. Review the preview, then Accept to apply.`,
    };
  }

  // Heading / title rewrite
  if (/\b(heading|title|headline|hero text)\b/i.test(msg) || /\bchange (the )?(text|copy)\b/i.test(msg)) {
    const heading = firstOfType(tree, 'widget', 'heading');
    if (heading && heading.type === 'widget') {
      const quoted = msg.match(/["“](.+?)["”]/);
      const next =
        quoted?.[1] ??
        (lower.includes('welcome')
          ? 'Welcome to the next version of your site'
          : 'Ship beautiful pages, faster');
      const patch: TreePatch = {
        patchId: patchId(),
        createdAt: new Date().toISOString(),
        confidence: 0.88,
        rationale: `Rewrite the primary heading to better match your request: “${next}”.`,
        affectedNodeIds: [heading.id],
        operations: [
          {
            op: 'update_props',
            nodeId: heading.id,
            props: { content: next } as never,
          },
        ],
      };
      return {
        patches: [patch],
        assistantMessage: `Proposed a new headline on “${heading.id}”. Accept to apply (undoable).`,
      };
    }
  }

  // Soften / restyle a section
  if (/\b(spacing|padding|tighter|looser|compact)\b/i.test(msg)) {
    const section =
      firstSectionNamed(tree, /hero|pricing|feature/i) ?? firstOfType(tree, 'section');
    if (section) {
      const pad = lower.includes('tight') || lower.includes('compact') ? 48 : 120;
      const patch: TreePatch = {
        patchId: patchId(),
        createdAt: new Date().toISOString(),
        confidence: 0.8,
        rationale: `Adjust vertical padding on the ${('name' in section && section.name) || 'selected'} section for a ${pad < 80 ? 'tighter' : 'roomier'} rhythm.`,
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
        assistantMessage: 'Proposed a spacing tweak on a section. Preview highlights the target.',
      };
    }
  }

  // Default: insert a short testimonial-style text under the first column we find
  const column = firstOfType(tree, 'column');
  const parentId = column?.id ?? tree.root.id;
  const position =
    column && column.type !== 'widget' ? (column.children as TreeNode[]).length : 0;
  const nodeId = `w_ai_${Math.random().toString(36).slice(2, 7)}`;
  const node: TreeNode = {
    id: nodeId,
    type: 'widget',
    widgetType: 'text',
    props: {
      content: `<p><em>“${msg.slice(0, 120)}${msg.length > 120 ? '…' : ''}”</em> — added by AI assistant</p>`,
    },
    styles: {
      desktop: {
        fontSize: 16,
        lineHeight: 1.6,
        color: { type: 'token', tokenId: tree.tokens.colors[2]?.id ?? tree.tokens.colors[0]?.id ?? 'color-slate' },
        marginTop: 16,
      },
    },
    meta: {
      source: 'ai-generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confidence: 0.7,
      notes: 'Mock AI insert — replace when B12 is live',
    },
  };

  // Ensure parent accepts widgets
  let insertParent = parentId;
  let insertPos = position;
  if (!column) {
    // Fall back: append a note as update to first text
    const text = firstOfType(tree, 'widget', 'text');
    if (text) {
      const current = (text.type === 'widget' && 'content' in text.props
        ? String((text.props as { content: string }).content)
        : '') as string;
      const patch: TreePatch = {
        patchId: patchId(),
        createdAt: new Date().toISOString(),
        confidence: 0.65,
        rationale: `Append a short note reflecting your instruction onto an existing text block.`,
        affectedNodeIds: [text.id],
        operations: [
          {
            op: 'update_props',
            nodeId: text.id,
            props: {
              content: `${current}<p style="margin-top:12px;opacity:.8">${msg.slice(0, 160)}</p>`,
            } as never,
          },
        ],
      };
      return {
        patches: [patch],
        assistantMessage:
          'I drafted a small content update. Backend AI (B12) isn’t connected yet — this is a local demo patch.',
      };
    }
  } else {
    insertParent = column.id;
    insertPos = (column.type !== 'widget' ? (column.children as TreeNode[]).length : 0);
  }

  // Guard invalid insert into page
  const parentNode = findNode(tree, insertParent);
  if (!parentNode || parentNode.type === 'page' || parentNode.type === 'section' || parentNode.type === 'row') {
    // Can't insert widget there — style the hero section instead
    const section = firstOfType(tree, 'section');
    if (section) {
      const patch: TreePatch = {
        patchId: patchId(),
        createdAt: new Date().toISOString(),
        confidence: 0.72,
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
          'Proposed a light style change as a demo. Connect B12 for full natural-language editing.',
      };
    }
  }

  const patch: TreePatch = {
    patchId: patchId(),
    createdAt: new Date().toISOString(),
    confidence: 0.74,
    rationale: `Insert a text widget capturing your instruction under an existing column.`,
    affectedNodeIds: [insertParent, nodeId],
    operations: [
      {
        op: 'insert_node',
        parentId: insertParent,
        position: insertPos,
        node,
      },
    ],
  };

  return {
    patches: [patch],
    assistantMessage:
      'Here’s a proposed insert. Accept to apply (one undo step), or Reject to discard. (Local demo — B12 not wired.)',
  };
}
