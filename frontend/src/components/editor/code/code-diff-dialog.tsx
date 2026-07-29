import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { CodeDiff, StyleFieldChange } from '@/lib/code-sync';
import { isEmptyDiff } from '@/lib/code-sync';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Confirmation diff for code-view sync-back (F14). Because hand-edited code
 * is a higher-risk write path than panel edits, the parsed patch is shown
 * here for review — grouped by node — and only committed on explicit Apply.
 * Edits we couldn't map (structural changes, unknown props) are surfaced as
 * warnings rather than silently dropped.
 */
export function CodeDiffDialog({
  diff,
  onCancel,
  onApply,
}: {
  diff: CodeDiff | null;
  onCancel: () => void;
  onApply: (diff: CodeDiff) => void;
}) {
  const open = diff !== null;
  const empty = diff !== null && isEmptyDiff(diff);
  const changeCount = diff ? diff.styles.length + diff.content.length : 0;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Review code changes"
      description={
        diff === null
          ? undefined
          : empty
            ? 'No changes to apply.'
            : `${changeCount} ${changeCount === 1 ? 'element' : 'elements'} will be updated from your edits.`
      }
      className="max-w-2xl"
    >
      <div className="flex max-h-[70vh] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {diff !== null && diff.unresolved.length > 0 && (
            <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                {diff.unresolved.length} edit{diff.unresolved.length === 1 ? '' : 's'} couldn’t be applied
              </div>
              <ul className="ml-1 list-inside list-disc space-y-0.5 text-2xs text-foreground-muted">
                {diff.unresolved.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
              <p className="mt-1.5 text-2xs text-foreground-subtle">
                Structural changes need the server-side parser (coming later); the changes below
                are safe to apply now.
              </p>
            </div>
          )}

          {empty && (
            <p className="py-6 text-center text-sm text-foreground-muted">
              Your edits matched the generated code — nothing to change.
            </p>
          )}

          {diff !== null && diff.content.length > 0 && (
            <Section title="Text content">
              {diff.content.map((c) => (
                <div key={c.nodeId} className="rounded-md border border-border bg-surface p-2.5">
                  <div className="mb-1 text-2xs font-medium text-foreground-muted">{c.label}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <code className="min-w-0 flex-1 truncate rounded bg-danger/10 px-1.5 py-0.5 text-danger line-through">
                      {c.from || '(empty)'}
                    </code>
                    <ArrowRight className="h-3 w-3 shrink-0 text-foreground-subtle" />
                    <code className="min-w-0 flex-1 truncate rounded bg-success/10 px-1.5 py-0.5 text-success">
                      {c.to || '(empty)'}
                    </code>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {diff !== null && diff.styles.length > 0 && (
            <Section title="Styles">
              {diff.styles.map((s) => (
                <div key={s.nodeId} className="rounded-md border border-border bg-surface p-2.5">
                  <div className="mb-1.5 text-2xs font-medium text-foreground-muted">{s.label}</div>
                  <div className="flex flex-col gap-1">
                    {s.fields.map((f) => (
                      <StyleFieldRow key={f.key} field={f} />
                    ))}
                  </div>
                </div>
              ))}
            </Section>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={diff === null || empty}
            onClick={() => diff && onApply(diff)}
          >
            Apply changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function StyleFieldRow({ field }: { field: StyleFieldChange }) {
  const tag =
    field.kind === 'add' ? 'added' : field.kind === 'remove' ? 'removed' : 'changed';
  const tagColor =
    field.kind === 'add'
      ? 'bg-success/10 text-success'
      : field.kind === 'remove'
        ? 'bg-danger/10 text-danger'
        : 'bg-accent-subtle text-accent';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium ${tagColor}`}>{tag}</span>
      <code className="shrink-0 font-mono text-foreground">{field.key}</code>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 font-mono text-2xs">
        {field.from !== undefined && (
          <span className={field.kind === 'change' ? 'text-foreground-subtle line-through' : 'text-danger line-through'}>
            {field.from}
          </span>
        )}
        {field.kind === 'change' && <ArrowRight className="h-3 w-3 shrink-0 text-foreground-subtle" />}
        {field.to !== undefined && <span className="text-success">{field.to}</span>}
      </div>
    </div>
  );
}
