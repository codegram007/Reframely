import { Loader2, Check, type LucideIcon, UploadCloud, ScanSearch, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportPhase, ImportSummary } from '@/stores/import-store';

interface Step {
  key: Exclude<ImportPhase, 'idle' | 'ready' | 'error'>;
  label: string;
  icon: LucideIcon;
}

// 'uploading' and 'importing' collapse into one visible "Importing" step.
const STEPS: Step[] = [
  { key: 'importing', label: 'Importing source', icon: UploadCloud },
  { key: 'snapshotting', label: 'Rendering pages', icon: ScanSearch },
  { key: 'classifying', label: 'Mapping widgets', icon: Boxes },
];

const ORDER: ImportPhase[] = ['uploading', 'importing', 'snapshotting', 'classifying', 'ready'];

function rank(phase: ImportPhase): number {
  const i = ORDER.indexOf(phase);
  return i === -1 ? 0 : i;
}

interface ImportProgressProps {
  phase: ImportPhase;
  uploadProgress: number;
  projectName: string | null;
  summary: ImportSummary | null;
}

/**
 * Staged progress for the import pipeline. Each backend call resolving
 * advances a step. Once classified, we surface the real "N sections,
 * M widgets" summary the PRD onboarding asks for.
 */
export function ImportProgress({ phase, uploadProgress, projectName, summary }: ImportProgressProps) {
  const currentRank = rank(phase === 'uploading' ? 'importing' : phase);

  return (
    <div className="flex flex-col items-center px-8 py-10 text-center animate-fade-in">
      {summary ? (
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-6 w-6" />
        </div>
      ) : (
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      <h3 className="text-lg font-semibold tracking-tight text-foreground">
        {summary ? 'Import complete' : `Importing ${projectName ?? 'your site'}…`}
      </h3>

      {summary ? (
        <p className="mt-1.5 max-w-sm text-sm text-foreground-muted">
          We found{' '}
          <span className="font-medium text-foreground">{summary.sectionCount} sections</span> and{' '}
          <span className="font-medium text-foreground">{summary.widgetCount} widgets</span> across{' '}
          {summary.pageCount} {summary.pageCount === 1 ? 'page' : 'pages'}. Opening the editor…
        </p>
      ) : (
        <p className="mt-1.5 max-w-sm text-sm text-foreground-muted">
          This runs a real browser over your site and maps it into editable widgets — hang tight.
        </p>
      )}

      <ol className="mt-8 w-full max-w-xs space-y-1">
        {STEPS.map((step) => {
          const stepRank = rank(step.key);
          const done = summary !== null || currentRank > stepRank;
          const active = !summary && currentRank === stepRank;
          const Icon = step.icon;
          const showUploadPct = active && step.key === 'importing' && phase === 'uploading';

          return (
            <li
              key={step.key}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active && 'bg-accent-subtle',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  done && 'bg-success/15 text-success',
                  active && 'bg-accent text-accent-foreground',
                  !done && !active && 'bg-surface-sunken text-foreground-subtle',
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <span
                className={cn(
                  'flex-1 text-left',
                  done && 'text-foreground-muted',
                  active && 'font-medium text-foreground',
                  !done && !active && 'text-foreground-subtle',
                )}
              >
                {step.label}
              </span>
              {showUploadPct && (
                <span className="text-xs tabular-nums text-accent">
                  {Math.round(uploadProgress * 100)}%
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
