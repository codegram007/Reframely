import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { ButtonWidgetProps, WidgetNode } from '@/lib/schema';
import { useTreeStore } from '@/stores/tree-store';
import { ContentField } from './content-field';
import { SegmentedControl } from '@/components/editor/style/controls';

/** Accepts absolute http(s), root/relative paths, anchors, mailto/tel. */
function validateHref(value: string): string | null {
  const v = value.trim();
  if (v === '') return null;
  if (/^(\/|#|mailto:|tel:)/.test(v)) return null;
  if (/^https?:\/\//i.test(v)) {
    try {
      new URL(v);
      return null;
    } catch {
      return 'That URL looks malformed.';
    }
  }
  return 'Use a full URL (https://…), a path (/about), an anchor (#section), or mailto:/tel:.';
}

/** Button / link content: visible text, destination URL, target, aria label. */
export function ButtonContent({ node }: { node: WidgetNode }) {
  const setProps = useTreeStore((s) => s.setProps);
  const props = node.props as ButtonWidgetProps;
  const [hrefError, setHrefError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ContentField label="Label">
        <input
          key={props.text}
          type="text"
          defaultValue={props.text}
          onBlur={(e) => setProps(node.id, { text: e.target.value })}
          className="h-8 w-full rounded-md border border-border bg-surface-sunken px-2 text-xs text-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="Button text"
        />
      </ContentField>

      <ContentField label="Link URL" hint={hrefError ?? undefined}>
        <div className="relative flex items-center">
          <input
            key={props.href ?? ''}
            type="text"
            defaultValue={props.href ?? ''}
            spellCheck={false}
            onChange={(e) => setHrefError(validateHref(e.target.value))}
            onBlur={(e) => {
              const v = e.target.value.trim();
              const err = validateHref(v);
              setHrefError(err);
              if (!err) setProps(node.id, { href: v || undefined });
            }}
            className={`h-8 w-full rounded-md border bg-surface-sunken pl-2 pr-7 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              hrefError ? 'border-danger focus-visible:border-danger' : 'border-border focus-visible:border-accent'
            }`}
            placeholder="https://example.com"
          />
          <ExternalLink className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-foreground-subtle" />
        </div>
      </ContentField>

      <ContentField label="Opens in">
        <SegmentedControl
          value={props.target ?? '_self'}
          onChange={(v) => setProps(node.id, { target: v === '_self' ? undefined : v })}
          options={[
            { value: '_self', label: 'Same tab' },
            { value: '_blank', label: 'New tab' },
          ]}
        />
      </ContentField>

      <ContentField label="Accessible label" hint="Optional — overrides the visible text for screen readers.">
        <input
          key={props.ariaLabel ?? ''}
          type="text"
          defaultValue={props.ariaLabel ?? ''}
          onBlur={(e) => setProps(node.id, { ariaLabel: e.target.value.trim() || undefined })}
          className="h-8 w-full rounded-md border border-border bg-surface-sunken px-2 text-xs text-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="e.g. Get started with Acme"
        />
      </ContentField>
    </div>
  );
}
