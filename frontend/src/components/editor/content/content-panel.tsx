import { FileQuestion } from 'lucide-react';
import type { TreeNode, WidgetNode } from '@/lib/schema';
import { PanelPlaceholder } from '@/components/editor/panel-placeholder';
import { TextContent } from './text-content';
import { ImageContent } from './image-content';
import { ButtonContent } from './button-content';
import { IconContent } from './icon-content';

/** Widget types with no editable content of their own in F8. */
const CODE_LIKE = new Set(['embed', 'custom-html', 'video', 'list']);

/**
 * Content tab dispatcher — renders the right content editor for the
 * selected widget type. Non-widget nodes (section/row/column) and
 * structural/code-like widgets show an explanatory empty state.
 */
export function ContentPanel({ node }: { node: TreeNode }) {
  if (node.type !== 'widget') {
    return (
      <PanelPlaceholder
        icon={<FileQuestion className="h-5 w-5" />}
        title={`${labelFor(node.type)} has no content`}
        hint="Layout containers are styled in the Style tab. Select a widget (text, image, button…) to edit its content."
      />
    );
  }

  const widget = node as WidgetNode;
  switch (widget.widgetType) {
    case 'text':
    case 'heading':
      return <TextContent node={widget} />;
    case 'image':
      return <ImageContent node={widget} />;
    case 'button':
      return <ButtonContent node={widget} />;
    case 'icon':
      return <IconContent node={widget} />;
    default:
      return (
        <PanelPlaceholder
          icon={<FileQuestion className="h-5 w-5" />}
          title={CODE_LIKE.has(widget.widgetType) ? 'Edited as markup' : 'No content editor'}
          hint={
            CODE_LIKE.has(widget.widgetType)
              ? 'This widget preserves its original markup. Rich content editing for this type is coming later.'
              : 'This widget type has no content controls yet.'
          }
        />
      );
  }
}

function labelFor(type: TreeNode['type']): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
