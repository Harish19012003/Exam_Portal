import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthGuard } from './AuthGuard';
import { AppFooter } from '../components/AppFooter/AppFooter';
import { PageGate } from './PageGate';
import { ROLES } from '@exam-view/shared';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { RouteErrorPage } from '../components/ErrorPage/ErrorPage';
import { NotFoundScreen } from '../components/ErrorPage/NotFoundScreen';

import { DashboardHome } from '../pages/DashboardHome';
import { ExamsPage } from '../pages/ExamsPage';

import { LoginPage } from '../pages/LoginPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { LandingPage } from '../pages/LandingPage';
import { UsersPage } from '../pages/UsersPage';
import { TablesPage } from '../pages/TablesPage';
import { ExamDayPage } from '../pages/ExamDayPage';
import { ExamSubRoute, ExamIndexRedirect } from '../pages/ExamSubPage';
import { VendorsPage } from '../pages/VendorsPage';
import { SeqViewPage } from '../pages/SeqViewPage';
import { ProfilePage } from '../pages/ProfilePage';
import { SettingsPage } from '../pages/SettingsPage';
const UnauthorizedPage = () => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-app, #f9fafb)', color: 'var(--text-primary, #030712)', padding: '24px', textAlign: 'center' }}>
    <h1 style={{ fontSize: '72px', fontWeight: '800', margin: 0, color: '#dc2626' }}>403</h1>
    <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Access Denied</h2>
    <p style={{ color: 'var(--text-secondary, #6b7280)', maxWidth: '420px', margin: 0 }}>You do not have the required permissions to view this resource.</p>
    <AppFooter variant="floating" />
    <a href="/dashboard" style={{ marginTop: '12px', padding: '10px 20px', borderRadius: '8px', background: 'var(--primary-color, #2563eb)', color: '#fff', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Back to Dashboard</a>
  </div>
);

const PublicShell = () => (
  <>
    <AuthGuard requireAuth={false} />
    <AppFooter variant="floating" />
  </>
);

/** DEV only: open /__error-preview (full page) or /dashboard-preview-error (inside the app shell) to see the error screens. */
const ErrorPreview = () => {
  const type = new URLSearchParams(window.location.search).get('type');
  throw new Error(
    type === 'stale'
      ? 'Failed to fetch dynamically imported module: /assets/ExamsPage-3fa9c1.js'
      : 'Preview: something broke while rendering this page',
  );
};

const appRoutes = [
  ...(import.meta.env.DEV ? [{ path: '/__error-preview', element: <ErrorPreview /> }] : []),
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    // Public routes (accessible only when NOT logged in)
    element: <PublicShell />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: '/reset-password',
        element: <ResetPasswordPage />,
      },
    ],
  },
  {
    // Protected routes (requires login)
    element: <AuthGuard requireAuth={true} />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          ...(import.meta.env.DEV ? [{ path: '/dashboard-preview-error', element: <ErrorPreview /> }] : []),
          {
            path: '/dashboard',
            element: <PageGate page="dashboard"><DashboardHome /></PageGate>,
          },
          {
            path: '/profile',
            element: <ProfilePage />,
          },
          {
            path: '/settings',
            element: <SettingsPage />,
          },
          {
            path: '/exams',
            element: <PageGate page="exams"><ExamsPage /></PageGate>,
          },
          {
            path: '/exam-day',
            element: <PageGate page="exam_day"><ExamDayPage /></PageGate>,
          },
          {
            path: '/exams/:examId',
            element: <PageGate page="exams"><ExamIndexRedirect /></PageGate>,
          },
          {
            path: '/exams/:examId/:subTab',
            element: <PageGate page="exams"><ExamSubRoute /></PageGate>,
          },
          {
            path: '/tables',
            element: <PageGate page="tables"><TablesPage /></PageGate>,
          },
          {
            path: '/vendors',
            element: <PageGate page="vendors"><VendorsPage /></PageGate>,
          },
          {
            path: '/seq-view',
            element: <PageGate page="seq_view"><SeqViewPage /></PageGate>,
          },
          {
            path: '/users',
            element: <Navigate to="/settings?tab=users" replace />,
          },
          {
            // Admin only routes
            element: <AuthGuard requireAuth={true} allowedRoles={[ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]} />,
            children: [
              {
                path: '/admin',
                element: <Navigate to="/settings?tab=users" replace />,
              }
            ]
          }
        ]
      },
      // Backward compatibility redirects from legacy /dashboard/* paths to clean top-level paths
      {
        path: '/dashboard/profile',
        element: <Navigate to="/profile" replace />,
      },
      {
        path: '/dashboard/exams',
        element: <Navigate to="/exams" replace />,
      },
      {
        path: '/dashboard/tables',
        element: <Navigate to="/tables" replace />,
      },
      {
        path: '/dashboard/vendors',
        element: <Navigate to="/vendors" replace />,
      },
      {
        path: '/dashboard/users',
        element: <Navigate to="/users" replace />,
      },
      {
        path: '/dashboard/admin',
        element: <Navigate to="/admin" replace />,
      },
    ],
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '*',
    element: <NotFoundScreen />,
  },
];

// One pathless parent carries the error screen, so any crash or failed route below shows it instead of
// the default "Unexpected Application Error" page.
export const router = createBrowserRouter([{ errorElement: <RouteErrorPage />, children: appRoutes }]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
