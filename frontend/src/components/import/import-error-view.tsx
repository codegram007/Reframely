import { AlertTriangle, Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImportErrorInfo } from '@/stores/import-store';

interface ImportErrorViewProps {
  error: ImportErrorInfo;
  onRetry: () => void;
}

/**
 * Human-readable headline per known backend error code. The backend's
 * own `message` is always shown verbatim underneath as the specific
 * detail; this just adds a friendlier title.
 */
const HEADLINES: Record<string, string> = {
  NOT_A_FRONTEND_PROJECT: "This doesn't look like a front-end project",
  INVALID_ZIP: "That zip couldn't be read",
  INVALID_GITHUB_URL: "That GitHub URL isn't valid",
  GITHUB_FETCH_FAILED: "We couldn't fetch that repository",
  INVALID_URL: "That URL isn't valid",
  SITE_FETCH_FAILED: "We couldn't reach that site",
  RENDER_FAILED: "We couldn't render that site",
  NO_SOURCE_FILES: 'No usable files were found',
  MISSING_FILE: 'No file was attached',
  NETWORK: 'Connection problem',
  UNKNOWN: 'Import failed',
};

/**
 * The PRD's onboarding risk-mitigation: whenever an import looks like it
 * might be a full application rather than a static front-end, remind the
 * user what Vibestudio is for. Always shown for the explicit
 * NOT_A_FRONTEND_PROJECT code; also shown for fetch/render failures where
 * an app (SPA behind auth, server-rendered) is a likely cause.
 */
const SCOPE_HINT_CODES = new Set([
  'NOT_A_FRONTEND_PROJECT',
  'SITE_FETCH_FAILED',
  'RENDER_FAILED',
  'NO_SOURCE_FILES',
]);

export function ImportErrorView({ error, onRetry }: ImportErrorViewProps) {
  const headline = HEADLINES[error.code] ?? HEADLINES.UNKNOWN;
  const showScopeHint = SCOPE_HINT_CODES.has(error.code);

  return (
    <div className="flex flex-col items-center px-8 py-10 text-center animate-fade-in">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>

      <h3 className="text-lg font-semibold tracking-tight text-foreground">{headline}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-foreground-muted">{error.message}</p>

      {showScopeHint && (
        <div className="mt-5 flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface-sunken p-3 text-left">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-xs leading-relaxed text-foreground-muted">
            Vibestudio is a visual editor for{' '}
            <span className="font-medium text-foreground">front-end / design projects</span> —
            static sites, landing pages, and marketing pages built from HTML, CSS, and JavaScript.
            It isn't built for full applications with backend logic, databases, or authenticated
            areas; those parts can't be imported or edited here.
          </p>
        </div>
      )}

      <div className="mt-6">
        <Button variant="secondary" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>

      <p className="mt-3 text-2xs text-foreground-subtle">Error code: {error.code}</p>
    </div>
  );
}
