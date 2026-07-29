import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Upload,
  Github,
  Link2,
  Plus,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import { ImportModal } from '@/components/import/import-modal';
import { useProjectsStore, type Project } from '@/stores/projects-store';
import { cn } from '@/lib/utils';

interface ImportMethod {
  icon: LucideIcon;
  title: string;
  description: string;
}

const importMethods: ImportMethod[] = [
  { icon: Upload, title: 'Upload a .zip', description: 'Drop in a static HTML/CSS/JS bundle.' },
  { icon: Github, title: 'From GitHub', description: 'Point at a public repository.' },
  { icon: Link2, title: 'From a URL', description: 'Snapshot any live public site.' },
];

export function DashboardPage() {
  const projects = useProjectsStore((s) => s.projects);
  const hasProjects = projects.length > 0;
  const [importOpen, setImportOpen] = useState(false);
  const location = useLocation();

  // Landing CTAs can deep-link with { openImport: true }.
  useEffect(() => {
    const state = location.state as { openImport?: boolean } | null;
    if (state?.openImport) {
      setImportOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <header className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Import a site to start editing visually.
            </p>
          </div>
          {hasProjects && (
            <Button variant="primary" onClick={() => setImportOpen(true)}>
              <Plus className="h-4 w-4" />
              New import
            </Button>
          )}
        </header>

        {hasProjects ? <ProjectGrid projects={projects} /> : <EmptyState onImport={() => setImportOpen(true)} />}
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="animate-fade-in rounded-lg border border-dashed border-border-strong bg-surface/40 bg-dotgrid px-8 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="mb-5 rounded-2xl bg-surface p-3 shadow-sm">
          <Logo markOnly />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Bring your first site into Vibestudio
        </h2>
        <p className="mt-2 max-w-md text-sm text-foreground-muted">
          Vibestudio imports an existing website and maps it into editable
          sections, rows, and widgets — no rebuild required.
        </p>

        <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
          {importMethods.map((m) => (
            <ImportCard key={m.title} method={m} onClick={onImport} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportCard({ method, onClick }: { method: ImportMethod; onClick: () => void }) {
  const Icon = method.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left',
        'shadow-xs transition-all duration-150 ease-out-expo',
        'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      )}
    >
      <span className="rounded-md bg-accent-subtle p-2 text-accent transition-transform duration-150 ease-out-expo group-hover:scale-105">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="mt-1 text-sm font-medium text-foreground">{method.title}</span>
      <span className="text-xs leading-relaxed text-foreground-muted">{method.description}</span>
    </button>
  );
}

function ProjectGrid({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <button
          key={p.id}
          onClick={() => navigate(`/editor/${p.id}`)}
          className={cn(
            'group flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left shadow-xs',
            'transition-all duration-150 ease-out-expo hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          )}
        >
          <div className="flex aspect-[16/10] items-center justify-center border-b border-border bg-surface-sunken bg-dotgrid">
            <Logo markOnly className="opacity-40" />
          </div>
          <div className="flex items-center justify-between gap-2 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
              <p className="truncate text-xs text-foreground-muted">{p.origin}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-foreground-subtle transition-transform duration-150 ease-out-expo group-hover:translate-x-0.5 group-hover:text-accent" />
          </div>
        </button>
      ))}
    </div>
  );
}
