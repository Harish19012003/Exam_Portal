import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthGuard } from './AuthGuard';
import { ROLES } from '@exam-view/shared';
import { DashboardLayout } from '../layouts/DashboardLayout';

import { DashboardHome } from '../pages/DashboardHome';
import { ExamsPage } from '../pages/ExamsPage';

import { LoginPage } from '../pages/LoginPage';
import { LandingPage } from '../pages/LandingPage';
import { UsersPage } from '../pages/UsersPage';
import { TablesPage } from '../pages/TablesPage';
const UnauthorizedPage = () => <div>Unauthorized</div>;
const NotFoundPage = () => <div>404 - Not Found</div>;

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
    ],
  },
  {
    // Protected routes (requires login)
    element: <AuthGuard requireAuth={true} />,
    children: [
      {
        path: '/dashboard',
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <DashboardHome />,
          },
          {
            path: 'exams',
            element: <ExamsPage />,
          },
          {
            path: 'tables',
            element: <TablesPage />,
          },
          {
            path: 'users',
            element: <UsersPage />,
          },
          {
            // Admin only routes
            element: <AuthGuard requireAuth={true} allowedRoles={[ROLES.SUPER_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.ADMIN]} />,
            children: [
              {
                path: 'admin',
                element: <UsersPage />,
              }
            ]
          }
        ]
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
