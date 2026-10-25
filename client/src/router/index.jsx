import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthGuard } from './AuthGuard';
import { ROLES } from '@exam-view/shared';
import { DashboardLayout } from '../layouts/DashboardLayout';

import { DashboardHome } from '../pages/DashboardHome';
import { ExamsPage } from '../pages/ExamsPage';
import { ExamExplorePage } from '../pages/ExamExplorePage';

import { LoginPage } from '../pages/LoginPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { LandingPage } from '../pages/LandingPage';
import { UsersPage } from '../pages/UsersPage';
import { TablesPage } from '../pages/TablesPage';
import { VendorsPage } from '../pages/VendorsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { SettingsPage } from '../pages/SettingsPage';
const UnauthorizedPage = () => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-app, #f8fafc)', color: 'var(--text-primary, #0f172a)', padding: '24px', textAlign: 'center' }}>
    <h1 style={{ fontSize: '72px', fontWeight: '800', margin: 0, color: '#dc2626' }}>403</h1>
    <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Access Denied</h2>
    <p style={{ color: 'var(--text-secondary, #64748b)', maxWidth: '420px', margin: 0 }}>You do not have the required permissions to view this resource.</p>
    <a href="/dashboard" style={{ marginTop: '12px', padding: '10px 20px', borderRadius: '8px', background: 'var(--primary-color, #2563eb)', color: '#fff', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Back to Dashboard</a>
  </div>
);

const NotFoundPage = () => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'var(--bg-app, #f8fafc)', color: 'var(--text-primary, #0f172a)', padding: '24px', textAlign: 'center' }}>
    <h1 style={{ fontSize: '72px', fontWeight: '800', margin: 0, color: 'var(--primary-color, #2563eb)' }}>404</h1>
    <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Page Not Found</h2>
    <p style={{ color: 'var(--text-secondary, #64748b)', maxWidth: '420px', margin: 0 }}>The requested page could not be found. Please check the URL or return to the dashboard.</p>
    <a href="/dashboard" style={{ marginTop: '12px', padding: '10px 20px', borderRadius: '8px', background: 'var(--primary-color, #2563eb)', color: '#fff', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>Back to Dashboard</a>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    // Public routes (accessible only when NOT logged in)
    element: <AuthGuard requireAuth={false} />,
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
          {
            path: '/dashboard',
            element: <DashboardHome />,
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
            element: <ExamsPage />,
          },
          {
            path: '/exams/:examId',
            element: <ExamExplorePage />,
          },
          {
            path: '/tables',
            element: <TablesPage />,
          },
          {
            path: '/vendors',
            element: <VendorsPage />,
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
    element: <NotFoundPage />,
  },
]);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
