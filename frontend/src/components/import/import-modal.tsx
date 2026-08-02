import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Github, Globe, type LucideIcon } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useImportStore } from '@/stores/import-store';
import { ZipTab } from './zip-tab';
import { UrlTab, isValidGitHubUrl, isValidHttpUrl } from './url-tab';
import { ImportProgress } from './import-progress';
import { ImportErrorView } from './import-error-view';

type TabId = 'zip' | 'github' | 'url';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'zip', label: 'Upload zip', icon: Upload },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'url', label: 'Public URL', icon: Globe },
];

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('zip');

  const phase = useImportStore((s) => s.phase);
  const uploadProgress = useImportStore((s) => s.uploadProgress);
  const projectName = useImportStore((s) => s.projectName);
  const summary = useImportStore((s) => s.summary);
  const error = useImportStore((s) => s.error);
  const startZip = useImportStore((s) => s.startZip);
  const startGitHub = useImportStore((s) => s.startGitHub);
  const startUrl = useImportStore((s) => s.startUrl);
  const reset = useImportStore((s) => s.reset);

  const running = phase !== 'idle' && phase !== 'error';
  const isReady = phase === 'ready';

  // On success, route into the editor. The editor reads the same store
  // to show its own loading→canvas transition, so we hand off directly.
  useEffect(() => {
    if (phase === 'ready' && summary) {
      const t = setTimeout(() => {
        onClose();
        navigate(`/editor/${summary.projectId}`);
      }, 1100);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, summary, navigate, onClose]);

  function handleClose() {
    if (running) return; // locked mid-import
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      dismissable={!running && !isReady}
      title={phase === 'error' ? 'Import failed' : running || isReady ? 'Importing' : 'Import a site'}
      description={
        phase === 'idle'
          ? 'Bring an existing front-end project into Reframely to edit it visually.'
          : undefined
      }
    >
      {phase === 'idle' ? (
        <div className="p-5">
          <div className="mb-5 flex gap-1 rounded-lg border border-border bg-surface-sunken p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-surface text-foreground shadow-xs'
                      : 'text-foreground-muted hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === 'zip' && <ZipTab onSubmit={(file) => void startZip(file)} />}
          {tab === 'github' && (
            <UrlTab
              placeholder="https://github.com/owner/repo"
              hint="Public repositories only. We import the static files at the default branch."
              cta="Import from GitHub"
              validate={(v) =>
                isValidGitHubUrl(v) ? null : 'Enter a full GitHub repo URL, e.g. https://github.com/owner/repo'
              }
              onSubmit={(v) => void startGitHub(v)}
            />
          )}
          {tab === 'url' && (
            <UrlTab
              placeholder="https://example.com"
              hint="We snapshot the live page as rendered. Public pages only — no login-gated areas."
              cta="Snapshot site"
              validate={(v) => (isValidHttpUrl(v) ? null : 'Enter a valid http(s) URL.')}
              onSubmit={(v) => void startUrl(v)}
            />
          )}
        </div>
      ) : phase === 'error' && error ? (
        <ImportErrorView error={error} onRetry={reset} />
      ) : (
        <ImportProgress
          phase={phase}
          uploadProgress={uploadProgress}
          projectName={projectName}
          summary={summary}
        />
      )}
    </Dialog>
  );
}
