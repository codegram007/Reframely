import { useCallback, useMemo } from 'react';
import type { Breakpoint, NodeStyles, StyleValue, TreeNode } from '@/lib/schema';
import {
  effectiveValue,
  isInherited,
  isOverridden,
  rawValue,
  type StyleKey,
} from '@/lib/style-engine';
import { useTreeStore } from '@/stores/tree-store';

export interface StyleField<T = StyleValue | boolean> {
  /** Effective value at the active breakpoint (override ?? desktop base). */
  value: T | undefined;
  /** Raw value explicitly set at this breakpoint only (no inheritance). */
  own: T | undefined;
  /** True when overridden at this (non-desktop) breakpoint. */
  overridden: boolean;
  /** True when the effective value is inherited from desktop. */
  inherited: boolean;
  /** Commit a discrete change (one undo step); undefined clears it. */
  set: (value: T | undefined) => void;
  /** Live preview during a drag session (no history). */
  preview: (value: T | undefined) => void;
}

/**
 * Style-editing accessor bound to a node + active breakpoint. Each
 * `field(key)` exposes the effective/own/overridden/inherited state plus
 * the write helpers, so controls stay dumb.
 */
export function useNodeStyles(node: TreeNode, breakpoint: Breakpoint) {
  const setStyle = useTreeStore((s) => s.setStyle);
  const previewStyle = useTreeStore((s) => s.previewStyle);
  const beginStyleSession = useTreeStore((s) => s.beginStyleSession);
  const commitStyleSession = useTreeStore((s) => s.commitStyleSession);

  const field = useCallback(
    <K extends StyleKey>(key: K): StyleField<NonNullable<NodeStyles[K]>> => ({
      value: effectiveValue(node, breakpoint, key) as NonNullable<NodeStyles[K]> | undefined,
      own: rawValue(node, breakpoint, key) as NonNullable<NodeStyles[K]> | undefined,
      overridden: isOverridden(node, breakpoint, key),
      inherited: isInherited(node, breakpoint, key),
      set: (value) => setStyle(node.id, breakpoint, key, value as StyleValue | boolean | undefined),
      preview: (value) =>
        previewStyle(node.id, breakpoint, key, value as StyleValue | boolean | undefined),
    }),
    [node, breakpoint, setStyle, previewStyle],
  );

  return useMemo(
    () => ({ field, beginStyleSession, commitStyleSession }),
    [field, beginStyleSession, commitStyleSession],
  );
}
