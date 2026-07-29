import { useEffect, useRef } from 'react';
import {
  Send,
  Loader2,
  Check,
  X,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssistantStore } from '@/stores/assistant-store';
import { cn } from '@/lib/utils';

/**
 * AI assistant chat (F17) — session scrollback, input, Accept/Reject.
 *
 * When `embedded`, renders as the body of the shared right dock (no second
 * column, no outer chrome — the dock owns the mode tabs).
 */
export function AssistantPanel({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);
  const messages = useAssistantStore((s) => s.messages);
  const input = useAssistantStore((s) => s.input);
  const setInput = useAssistantStore((s) => s.setInput);
  const send = useAssistantStore((s) => s.send);
  const sending = useAssistantStore((s) => s.sending);
  const pendingPatch = useAssistantStore((s) => s.pendingPatch);
  const pendingSummary = useAssistantStore((s) => s.pendingSummary);
  const accept = useAssistantStore((s) => s.accept);
  const reject = useAssistantStore((s) => s.reject);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingPatch, sending]);

  // Standalone (legacy) path: hide entirely when closed.
  if (!embedded && !open) return null;

  const body = (
    <>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'rounded-lg px-3 py-2 text-xs leading-relaxed',
              m.role === 'user' && 'ml-4 bg-accent text-accent-foreground',
              m.role === 'assistant' &&
                'mr-1 border border-border bg-surface-sunken text-foreground',
              m.role === 'system' &&
                'border border-dashed border-border bg-surface-sunken/50 text-foreground-muted',
            )}
          >
            {m.role === 'assistant' && (
              <div className="mb-1 flex items-center gap-1 text-2xs font-medium text-foreground-subtle">
                <MessageSquare className="h-3 w-3" />
                Assistant
                {m.outcome === 'accepted' && (
                  <span className="ml-auto text-success">Accepted</span>
                )}
                {m.outcome === 'rejected' && (
                  <span className="ml-auto text-foreground-subtle">Rejected</span>
                )}
                {m.outcome === 'pending' && (
                  <span className="ml-auto text-warning">Awaiting review</span>
                )}
              </div>
            )}
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.confidence !== undefined && m.outcome === 'pending' && (
              <p className="mt-1.5 text-2xs text-foreground-subtle">
                Confidence {(m.confidence * 100).toFixed(0)}%
              </p>
            )}
          </div>
        ))}

        {pendingPatch && pendingSummary && (
          <div className="rounded-lg border border-accent/40 bg-accent-subtle/40 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              Preview — not applied yet
            </div>
            <p className="text-xs font-medium text-foreground">{pendingSummary.headline}</p>
            <p className="mt-1 text-2xs text-foreground-muted">{pendingPatch.rationale}</p>
            <ul className="mt-2 space-y-0.5 text-2xs text-foreground-subtle">
              {pendingSummary.lines.map((line, i) => (
                <li key={i}>· {line}</li>
              ))}
            </ul>
            <p className="mt-2 text-2xs text-foreground-subtle">
              Confidence {(pendingPatch.confidence * 100).toFixed(0)}% · canvas highlights
              affected nodes
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" size="sm" className="flex-1" onClick={accept}>
                <Check className="h-3.5 w-3.5" />
                Accept
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={reject}>
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          </div>
        )}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="shrink-0 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(projectId);
        }}
      >
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for an edit…"
            rows={2}
            disabled={sending}
            className={cn(
              'min-h-[2.5rem] flex-1 resize-none rounded-md border border-border bg-surface-sunken px-2.5 py-2 text-xs text-foreground',
              'placeholder:text-foreground-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              'disabled:opacity-50',
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(projectId);
              }
            }}
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={sending || !input.trim()}
            className="self-end"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col">{body}</div>;
  }

  // Standalone fallback (should not mount in the editor after RightDock).
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-medium text-foreground">AI Assistant</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-foreground-subtle hover:bg-surface-sunken hover:text-foreground"
          aria-label="Close assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      {body}
    </aside>
  );
}
