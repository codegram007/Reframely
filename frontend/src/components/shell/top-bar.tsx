import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Rocket, ChevronRight, Sparkles, LogOut, Save, Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/brand/theme-toggle';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { UndoRedoControls } from '@/components/editor/undo-redo-controls';
import { DeployPanel } from '@/components/editor/deploy/deploy-panel';
import { useProjectsStore } from '@/stores/projects-store';
import { useDeployStore } from '@/stores/deploy-store';
import { useAssistantStore } from '@/stores/assistant-store';
import { useAuth } from '@/auth/auth-provider';
import { useTreeStore } from '@/stores/tree-store';
import { useEditorUiStore } from '@/stores/editor-ui-store';
import { flushVersionAutosave } from '@/lib/version-persist';

/**
 * Global top bar. On the editor route it shows the project name,
 * undo/redo (F15), AI toggle (F17), and Deploy (F16).
 */
export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const isEditor = location.pathname.startsWith('/editor/');
  const projectId = params.projectId ?? 'demo';
  const project = useProjectsStore((s) =>
    params.projectId ? s.getProject(params.projectId) : undefined,
  );
  const setDeployOpen = useDeployStore((s) => s.setPanelOpen);
  const assistantOpen = useAssistantStore((s) => s.open);
  const setAssistantOpen = useAssistantStore((s) => s.setOpen);
  const openLeftPanel = useEditorUiStore((s) => s.openLeftPanel);
  const tree = useTreeStore((s) => s.tree);
  const markProjectSaved = useProjectsStore((s) => s.markProjectSaved);
  const upsertProject = useProjectsStore((s) => s.upsertProject);
  const { user, signOut } = useAuth();
  const [saving, setSaving] = useState(false);

  const saveAndExit = async () => {
    if (!params.projectId || saving) return;
    setSaving(true);
    const result = await flushVersionAutosave(params.projectId, tree);
    setSaving(false);
    if (!result.ok) return;
    if (project) {
      markProjectSaved(params.projectId);
    } else {
      upsertProject({
        id: params.projectId,
        name: tree.root.title || 'Untitled project',
        origin: 'Saved in Reframely',
        status: 'ready',
        pageCount: 1,
        updatedAt: new Date().toISOString(),
      });
    }
    navigate('/app');
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="rounded-md transition-opacity hover:opacity-80">
            <Logo markOnly={isEditor} />
          </Link>

          {isEditor && (
            <>
              <ChevronRight className="h-4 w-4 text-foreground-subtle" />
              <span className="text-sm font-medium text-foreground">
                {project?.name ?? 'Untitled project'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditor && (
            <>
              <UndoRedoControls />
              <div className="mx-1 h-5 w-px bg-border" />
              <Button variant="secondary" size="sm" disabled={saving} onClick={() => void saveAndExit()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save & Exit'}
              </Button>
              <IconButton
                label="AI Assistant"
                variant="ghost"
                size="md"
                active={assistantOpen}
                onClick={() => {
                  const next = !assistantOpen;
                  setAssistantOpen(next);
                  if (next) openLeftPanel();
                }}
              >
                <Sparkles className="h-[18px] w-[18px]" />
              </IconButton>
              <div className="mx-1 h-5 w-px bg-border" />
            </>
          )}
          <ThemeToggle />
          <IconButton
            label={user?.email ? `Sign out ${user.email}` : 'Sign out'}
            variant="ghost"
            size="md"
            onClick={() => void signOut()}
          >
            <LogOut className="h-[18px] w-[18px]" />
          </IconButton>
          {isEditor && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <Button variant="primary" size="md" onClick={() => setDeployOpen(true)}>
                <Rocket className="h-4 w-4" />
                Deploy
              </Button>
            </>
          )}
        </div>
      </header>

      {isEditor && <DeployPanel projectId={projectId} />}
    </>
  );
}
