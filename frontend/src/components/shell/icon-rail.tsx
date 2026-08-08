import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, PanelsTopLeft, Sparkles, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { useAssistantStore } from '@/stores/assistant-store';
import { useEditorUiStore } from '@/stores/editor-ui-store';

interface RailItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

const items: RailItem[] = [
  { to: '/app', icon: LayoutGrid, label: 'Projects', end: true },
  { to: '/editor/demo', icon: PanelsTopLeft, label: 'Editor' },
];

function RailLink({ item }: { item: RailItem }) {
  const Icon = item.icon;
  return (
    <Tooltip label={item.label} side="right">
      <NavLink
        to={item.to}
        end={item.end ?? false}
        className={({ isActive }) =>
          cn(
            'relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150 ease-out-expo',
            'text-foreground-subtle hover:bg-surface-sunken hover:text-foreground',
            isActive && 'bg-accent-subtle text-accent hover:bg-accent-subtle hover:text-accent',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
            )}
            <Icon className="h-[18px] w-[18px]" />
          </>
        )}
      </NavLink>
    </Tooltip>
  );
}

/** Left icon rail — primary app navigation. */
export function IconRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const assistantOpen = useAssistantStore((s) => s.open);
  const toggleAssistant = useAssistantStore((s) => s.toggleOpen);
  const setAssistantOpen = useAssistantStore((s) => s.setOpen);
  const openLeftPanel = useEditorUiStore((s) => s.openLeftPanel);
  const onEditor = location.pathname.startsWith('/editor/');

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center justify-between border-r border-border bg-surface py-3">
      <div className="flex flex-col items-center gap-1">
        {items.map((item) => (
          <RailLink key={item.to} item={item} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <Tooltip label="AI Assistant" side="right">
          <button
            type="button"
            onClick={() => {
              if (onEditor) {
                const next = !assistantOpen;
                toggleAssistant();
                if (next) openLeftPanel();
              } else {
                setAssistantOpen(true);
                navigate('/editor/demo');
              }
            }}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150 ease-out-expo',
              'text-foreground-subtle hover:bg-surface-sunken hover:text-foreground',
              assistantOpen && onEditor && 'bg-accent-subtle text-accent hover:bg-accent-subtle hover:text-accent',
            )}
          >
            {assistantOpen && onEditor && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
            )}
            <Sparkles className="h-[18px] w-[18px]" />
          </button>
        </Tooltip>
        <RailLink item={{ to: '/settings', icon: Settings, label: 'Settings' }} />
      </div>
    </nav>
  );
}
