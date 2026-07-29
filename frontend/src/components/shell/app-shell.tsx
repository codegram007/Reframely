import { Outlet } from 'react-router-dom';
import { TopBar } from './top-bar';
import { IconRail } from './icon-rail';

/**
 * Root application chrome: top bar spanning full width, left icon rail,
 * and the routed page filling the remaining space. Individual pages
 * (dashboard, editor) own their internal layout.
 */
export function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
