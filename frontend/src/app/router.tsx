import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/auth/protected-route';
import { AppShell } from '@/components/shell/app-shell';
import { DashboardPage } from '@/pages/dashboard-page';
import { EditorPage } from '@/pages/editor-page';
import { ComingSoonPage } from '@/pages/coming-soon-page';
import { LoginPage } from '@/pages/login-page';
import { LandingPage } from '@/pages/landing-page';
import { HowItWorksPage } from '@/pages/how-it-works-page';
import { FeaturesPage } from '@/pages/features-page';
import { AiAssistantPage } from '@/pages/ai-assistant-page';
import { FaqPage } from '@/pages/faq-page';
import { NotFoundPage } from '@/pages/not-found-page';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/how-it-works', element: <HowItWorksPage /> },
  { path: '/features', element: <FeaturesPage /> },
  { path: '/ai', element: <AiAssistantPage /> },
  { path: '/ai-assistant', element: <AiAssistantPage /> },
  { path: '/faq', element: <FaqPage /> },
  { path: '/login', element: <LoginPage /> },
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
