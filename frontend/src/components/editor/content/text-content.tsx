import type { HeadingWidgetProps, TextWidgetProps, WidgetNode } from '@/lib/schema';
import { useTreeStore } from '@/stores/tree-store';
import { ContentField } from './content-field';
import { SegmentedControl } from '@/components/editor/style/controls';

/**
 * Text & heading content. The panel edits the raw `content` value (rich
 * text is authored inline on the canvas, F5); this mirrors and commits
 * the same field so both stay in sync. Headings also get a level control.
 */
export function TextContent({ node }: { node: WidgetNode }) {
  const setProps = useTreeStore((s) => s.setProps);
  const isHeading = node.widgetType === 'heading';
  const props = node.props as TextWidgetProps | HeadingWidgetProps;

  return (
    <div className="flex flex-col gap-3">
      <ContentField label="Text">
        <textarea
          key={props.content}
          defaultValue={props.content}
          rows={3}
          onBlur={(e) => setProps(node.id, { content: e.target.value })}
          className="w-full resize-y rounded-md border border-border bg-surface-sunken px-2 py-1.5 text-xs text-foreground placeholder:text-foreground-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="Enter text…"
        />
      </ContentField>

      {isHeading && (
        <ContentField label="Level">
          <SegmentedControl
            value={String((props as HeadingWidgetProps).level)}
            onChange={(v) => setProps(node.id, { level: Number(v) })}
            options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `H${n}` }))}
          />
        </ContentField>
      )}

      <p className="text-2xs text-foreground-subtle">
        Tip: double-click the element on the canvas to edit text inline.
      </p>
    </div>
  );
}
