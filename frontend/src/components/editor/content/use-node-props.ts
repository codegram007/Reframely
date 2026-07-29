import { useCallback } from 'react';
import type { WidgetNode } from '@/lib/schema';
import { useTreeStore } from '@/stores/tree-store';

/**
 * Props-editing accessor bound to a widget node. `set` commits one undo
 * step; `preview` updates live without history (paired with the store's
 * begin/commit session for drags like the cropper).
 */
export function useNodeProps(node: WidgetNode) {
  const setProps = useTreeStore((s) => s.setProps);
  const previewProps = useTreeStore((s) => s.previewProps);
  const beginSession = useTreeStore((s) => s.beginStyleSession);
  const commitSession = useTreeStore((s) => s.commitStyleSession);

  const set = useCallback(
    (patch: Record<string, unknown>) => setProps(node.id, patch),
    [setProps, node.id],
  );
  const preview = useCallback(
    (patch: Record<string, unknown>) => previewProps(node.id, patch),
    [previewProps, node.id],
  );

  return { props: node.props, set, preview, beginSession, commitSession };
}
