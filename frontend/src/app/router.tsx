import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '@/auth/require-auth';
import { AppShell } from '@/components/shell/app-shell';
import { DashboardPage } from '@/pages/dashboard-page';
import { EditorPage } from '@/pages/editor-page';
import { ComingSoonPage } from '@/pages/coming-soon-page';
import { LoginPage } from '@/pages/login-page';
import { NotFoundPage } from '@/pages/not-found-page';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
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
