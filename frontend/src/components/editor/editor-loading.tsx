import { Loader2, Check } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import type { ImportPhase, ImportSummary } from '@/stores/import-store';

const PHASE_LABEL: Record<ImportPhase, string> = {
  idle: 'Preparing…',
  uploading: 'Uploading source…',
  importing: 'Importing source…',
  snapshotting: 'Rendering pages…',
  classifying: 'Mapping widgets…',
  ready: 'Ready',
  error: 'Import failed',
};

interface EditorLoadingProps {
  phase: ImportPhase;
  summary: ImportSummary | null;
}

/**
 * Full-canvas loading screen shown when the editor opens straight off an
 * import. Reflects the live pipeline phase, and once classification is
 * done, the "we found N sections, M widgets" summary before the canvas
 * takes over.
 */
export function EditorLoading({ phase, summary }: EditorLoadingProps) {
  const done = phase === 'ready';
  return (
    <div className="flex h-full flex-col items-center justify-center bg-canvas bg-dotgrid px-6 text-center">
      <div className="mb-6 rounded-2xl bg-surface p-3 shadow-sm">
        <Logo markOnly />
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
        {done ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
        )}
        {PHASE_LABEL[phase]}
      </div>

      {summary && (
        <p className="max-w-sm text-sm text-foreground-muted">
          We found{' '}
          <span className="font-medium text-foreground">{summary.sectionCount} sections</span> and{' '}
          <span className="font-medium text-foreground">{summary.widgetCount} widgets</span> across{' '}
          {summary.pageCount} {summary.pageCount === 1 ? 'page' : 'pages'} — importing now.
        </p>
      )}
    </div>
  );
}
