import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Copy, Loader2, Pencil, X } from 'lucide-react';
import { generatePage } from '@/lib/codegen';
import {
  applyCodeDiff,
  isEmptyDiff,
  parseCodeEdits,
  type CodeDiff,
} from '@/lib/code-sync';
import { useTreeStore } from '@/stores/tree-store';
import { useCodeViewStore, type CodeLang } from '@/stores/code-view-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CodePane } from './code-pane';
import { CodeDiffDialog } from './code-diff-dialog';

/** Debounce a value so Monaco isn't rebuilt on every keystroke of a drag. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const TABS: { value: CodeLang; label: string }[] = [
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
];

/**
 * Code View (F13/F14) — replaces the canvas in the center pane. Shows the
 * page's generated HTML/CSS in Monaco, live-synced from the tree while
 * read-only. In edit mode the user hand-edits the code; "Review changes"
 * (or Cmd/Ctrl+S) parses their edits into a widget-tree patch and shows a
 * confirmation diff before anything is committed — raw-code edits never
 * auto-apply.
 */
export function CodeView() {
  const { projectId } = useParams();
  const tree = useTreeStore((s) => s.tree);
  const commit = useTreeStore((s) => s.commit);

  const lang = useCodeViewStore((s) => s.lang);
  const setLang = useCodeViewStore((s) => s.setLang);
  const editable = useCodeViewStore((s) => s.editable);
  const setEditable = useCodeViewStore((s) => s.setEditable);
  const draftHtml = useCodeViewStore((s) => s.draftHtml);
  const draftCss = useCodeViewStore((s) => s.draftCss);
  const setDraft = useCodeViewStore((s) => s.setDraft);
  const resetDrafts = useCodeViewStore((s) => s.resetDrafts);

  // Generated output, debounced so canvas-driven edits don't thrash Monaco.
  const generated = useMemo(() => generatePage(tree), [tree]);
  const liveHtml = useDebounced(generated.html, 150);
  const liveCss = useDebounced(generated.css, 150);

  // Freeze buffers at the moment edit mode starts so live regen can't
  // drift under an open session. Drafts (if any) win over the freeze.
  const [freezeHtml, setFreezeHtml] = useState<string | null>(null);
  const [freezeCss, setFreezeCss] = useState<string | null>(null);

  const htmlValue = editable
    ? draftHtml ?? freezeHtml ?? liveHtml
    : liveHtml;
  const cssValue = editable
    ? draftCss ?? freezeCss ?? liveCss
    : liveCss;
  const value = lang === 'html' ? htmlValue : cssValue;

  // Dirty only when the user actually changed a buffer vs the freeze.
  const dirty =
    editable &&
    ((draftHtml !== null && draftHtml !== (freezeHtml ?? generated.html)) ||
      (draftCss !== null && draftCss !== (freezeCss ?? generated.css)));

  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<CodeDiff | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const onReview = useCallback(async () => {
    if (reviewing) return;
    setReviewError(null);
    setReviewing(true);
    try {
      const diff = await parseCodeEdits(
        tree,
        draftHtml ?? freezeHtml ?? generated.html,
        draftCss ?? freezeCss ?? generated.css,
        projectId ? { projectId } : undefined,
      );
      setPending(diff);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not parse code edits.');
    } finally {
      setReviewing(false);
    }
  }, [
    reviewing,
    tree,
    draftHtml,
    draftCss,
    freezeHtml,
    freezeCss,
    generated.html,
    generated.css,
    projectId,
  ]);

  // Cmd/Ctrl+S → review (never silent-apply). Also the prompt's "on save".
  useEffect(() => {
    if (!editable) return;
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) void onReview();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, dirty, onReview]);

  const onApply = (diff: CodeDiff) => {
    if (!isEmptyDiff(diff)) commit((t) => applyCodeDiff(t, diff));
    setPending(null);
    resetDrafts();
    setFreezeHtml(null);
    setFreezeCss(null);
    setEditable(false); // leave edit mode after a successful apply
  };

  const toggleEdit = () => {
    if (editable) {
      // Cancel discards drafts; use Review to commit.
      setEditable(false);
      setFreezeHtml(null);
      setFreezeCss(null);
      setReviewError(null);
    } else {
      // Freeze current generated code as the session baseline.
      setFreezeHtml(generated.html);
      setFreezeCss(generated.css);
      setEditable(true);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-sunken">
      {/* Header: language tabs (left), actions (right). */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setLang(t.value)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                lang === t.value
                  ? 'bg-surface text-foreground shadow-xs'
                  : 'text-foreground-muted hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCopy}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>

          {editable ? (
            <>
              <Button variant="ghost" size="sm" onClick={toggleEdit}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void onReview()}
                disabled={!dirty || reviewing}
              >
                {reviewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {reviewing ? 'Parsing…' : 'Review changes'}
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={toggleEdit}>
              <Pencil className="h-4 w-4" />
              Edit code
            </Button>
          )}
        </div>
      </div>

      {editable && (
        <div className="shrink-0 border-b border-border bg-warning/10 px-3 py-1.5 text-2xs text-foreground-muted">
          Editing raw code. Press <kbd className="rounded border border-border bg-surface px-1">⌘/Ctrl+S</kbd> or
          {' '}<strong>Review changes</strong> to parse into the visual model — nothing is committed
          automatically.
        </div>
      )}

      {reviewError && (
        <div className="shrink-0 border-b border-danger/30 bg-danger/10 px-3 py-1.5 text-2xs text-danger">
          {reviewError}
        </div>
      )}

      {/* Editor surface. key by lang so the model swaps cleanly per tab. */}
      <div className="min-h-0 flex-1">
        <CodePane
          key={lang}
          language={lang}
          value={value}
          readOnly={!editable}
          onChange={(v) => setDraft(lang, v)}
        />
      </div>

      <CodeDiffDialog
        diff={pending}
        onCancel={() => setPending(null)}
        onApply={onApply}
      />
    </div>
  );
}
