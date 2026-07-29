import { useEffect } from 'react';
import {
  Rocket,
  Download,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidDomain, useDeployStore } from '@/stores/deploy-store';
import { cn } from '@/lib/utils';

/**
 * Deploy panel (F16) — opened from the top-bar Deploy button.
 * Shows deploy lifecycle, redeploy, custom domain, and a clearly
 * separate Export (zip) action.
 */
export function DeployPanel({ projectId }: { projectId: string }) {
  const open = useDeployStore((s) => s.panelOpen);
  const setOpen = useDeployStore((s) => s.setPanelOpen);
  const status = useDeployStore((s) => s.status);
  const url = useDeployStore((s) => s.url);
  const lastDeployedAt = useDeployStore((s) => s.lastDeployedAt);
  const errorMessage = useDeployStore((s) => s.errorMessage);
  const usedMock = useDeployStore((s) => s.usedMock);
  const domain = useDeployStore((s) => s.domain);
  const domainStatus = useDeployStore((s) => s.domainStatus);
  const domainInstructions = useDeployStore((s) => s.domainInstructions);
  const setDomainInput = useDeployStore((s) => s.setDomainInput);
  const hydrate = useDeployStore((s) => s.hydrate);
  const deploy = useDeployStore((s) => s.deploy);
  const attachDomain = useDeployStore((s) => s.attachDomain);
  const exportPhase = useDeployStore((s) => s.exportPhase);
  const exportResult = useDeployStore((s) => s.exportResult);
  const exportError = useDeployStore((s) => s.exportError);
  const exportZip = useDeployStore((s) => s.exportZip);

  useEffect(() => {
    if (open && projectId) void hydrate(projectId);
  }, [open, projectId, hydrate]);

  const deploying = status === 'deploying' || status === 'queued';
  const domainOk = domain.trim() === '' || isValidDomain(domain);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Deploy & export"
      description="Publish a live site, or download a static zip of the generated pages."
      className="max-w-lg"
    >
      <div className="flex flex-col gap-5 px-5 py-4">
        {/* ---- Status ---- */}
        <section className="rounded-lg border border-border bg-surface-sunken p-3.5">
          <div className="flex items-start gap-3">
            <StatusIcon status={status} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{statusLabel(status)}</p>
              {url && status === 'live' && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 truncate text-xs text-accent hover:underline"
                >
                  {url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
              {lastDeployedAt && (
                <p className="mt-1 text-2xs text-foreground-subtle">
                  Last deployed {new Date(lastDeployedAt).toLocaleString()}
                  {usedMock ? ' · local preview' : ''}
                </p>
              )}
              {errorMessage && status === 'failed' && (
                <p className="mt-1 text-xs text-danger">{errorMessage}</p>
              )}
            </div>
          </div>
        </section>

        {/* ---- Deploy actions ---- */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Deploy
          </h3>
          <p className="mb-3 text-xs text-foreground-muted">
            Publishes the generated site to hosting. This is separate from exporting a zip
            for download.
          </p>
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={deploying}
            onClick={() => void deploy(projectId)}
          >
            {deploying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === 'live' ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {deploying ? 'Deploying…' : status === 'live' ? 'Redeploy' : 'Deploy now'}
          </Button>
        </section>

        {/* ---- Custom domain ---- */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Custom domain
          </h3>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle" />
              <Input
                value={domain}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="www.example.com"
                className="pl-8"
                disabled={deploying}
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              disabled={!domain.trim() || !domainOk || deploying}
              onClick={() => void attachDomain(projectId)}
            >
              Attach
            </Button>
          </div>
          <DomainStatusLine status={domainStatus} instructions={domainInstructions} invalid={!domainOk && domain.trim() !== ''} />
        </section>

        {/* ---- Export (distinct from deploy) ---- */}
        <section className="border-t border-border pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Export
          </h3>
          <p className="mb-3 text-xs text-foreground-muted">
            Download a static HTML/CSS zip of the generated site — same files that would go
            live on deploy, without publishing.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="w-full"
            disabled={exportPhase === 'exporting'}
            onClick={() => void exportZip(projectId)}
          >
            {exportPhase === 'exporting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportPhase === 'exporting' ? 'Preparing export…' : 'Export zip'}
          </Button>
          {exportPhase === 'ready' && exportResult && (
            <p className="mt-2 text-2xs text-foreground-subtle">
              {exportResult.fileCount} file{exportResult.fileCount === 1 ? '' : 's'} ·{' '}
              {formatBytes(exportResult.totalBytes)}
              {exportError ? ` · ${exportError}` : ''}
            </p>
          )}
          {exportPhase === 'error' && exportError && (
            <p className="mt-2 text-xs text-danger">{exportError}</p>
          )}
        </section>
      </div>
    </Dialog>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'never':
      return 'Never deployed';
    case 'queued':
      return 'Deploy queued…';
    case 'deploying':
      return 'Deploying…';
    case 'live':
      return 'Live';
    case 'failed':
      return 'Last deploy failed';
    default:
      return status;
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'deploying' || status === 'queued') {
    return (
      <div className="rounded-lg bg-accent-subtle p-2 text-accent">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (status === 'live') {
    return (
      <div className="rounded-lg bg-success/10 p-2 text-success">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="rounded-lg bg-danger/10 p-2 text-danger">
        <AlertCircle className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-surface p-2 text-foreground-subtle ring-1 ring-border">
      <Rocket className="h-4 w-4" />
    </div>
  );
}

function DomainStatusLine({
  status,
  instructions,
  invalid,
}: {
  status: string;
  instructions: string | null;
  invalid: boolean;
}) {
  if (invalid) {
    return <p className="mt-1.5 text-2xs text-danger">Enter a valid hostname (e.g. www.example.com).</p>;
  }
  if (status === 'none' && !instructions) {
    return (
      <p className="mt-1.5 text-2xs text-foreground-subtle">
        Optional. Attach after the first deploy to serve on your own domain.
      </p>
    );
  }
  return (
    <div className="mt-1.5 space-y-1">
      <p
        className={cn(
          'text-2xs font-medium',
          status === 'verified' && 'text-success',
          status === 'pending' && 'text-warning',
          status === 'failed' && 'text-danger',
          status === 'none' && 'text-foreground-subtle',
        )}
      >
        {status === 'verified' && 'Domain verified'}
        {status === 'pending' && 'Pending DNS verification'}
        {status === 'failed' && 'Domain verification failed'}
      </p>
      {instructions && <p className="text-2xs text-foreground-muted">{instructions}</p>}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
