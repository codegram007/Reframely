import { ReactNode } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '../frontend/src/auth/auth-provider';
import { AppShell } from '../frontend/src/components/shell/app-shell';
import { DashboardPage } from '../frontend/src/pages/dashboard-page';
import { EditorPage } from '../frontend/src/pages/editor-page';
import { ComingSoonPage } from '../frontend/src/pages/coming-soon-page';
import { LoginPage } from '../frontend/src/pages/login-page';
import { LandingPage } from '../frontend/src/pages/landing-page';
import { HowItWorksPage } from '../frontend/src/pages/how-it-works-page';
import { FeaturesPage } from '../frontend/src/pages/features-page';
import { AiAssistantPage } from '../frontend/src/pages/ai-assistant-page';
import { FaqPage } from '../frontend/src/pages/faq-page';
import { NotFoundPage } from '../frontend/src/pages/not-found-page';

export interface ProtectedRouteProps {
  children?: ReactNode;
}

/**
 * ProtectedRoute component:
 * Wraps private routes (e.g. /app, /editor/:projectId).
 * Redirects unauthenticated users to the LoginPage while maintaining
 * the ability for logged-out users to view the public LandingPage.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { loading, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-foreground-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Restoring session" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export const router = createBrowserRouter([
  // Public standalone routes
  { path: '/', element: <LandingPage /> },
  { path: '/how-it-works', element: <HowItWorksPage /> },
  { path: '/features', element: <FeaturesPage /> },
  { path: '/ai', element: <AiAssistantPage /> },
  { path: '/ai-assistant', element: <AiAssistantPage /> },
  { path: '/faq', element: <FaqPage /> },
  { path: '/login', element: <LoginPage /> },

  // Private routes wrapped with ProtectedRoute
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: 'app', element: <DashboardPage /> },
          { path: 'editor/:projectId', element: <EditorPage /> },
          {
            path: 'assistant',
            element: (
              <ComingSoonPage title="AI Assistant">
                Open any project in the Editor, then use the sparkles control in the top bar or
                icon rail — the assistant docks beside the canvas with preview-before-apply.
              </ComingSoonPage>
            ),
          },
          { path: 'settings', element: <ComingSoonPage title="Settings" /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
