import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * AuthGuard component wraps routes that require authentication.
 * Checks for token, server-session or cached user session,
 * and ensures offline refreshes or server restarts never cause unwanted logouts.
 */
export const AuthGuard = ({ requireAuth = true, allowedRoles = [] }) => {
  const token = localStorage.getItem('accessToken');
  const sessionActive = localStorage.getItem('sessionActive') === 'true';
  let user = null;
  let userRole = 'admin';

  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      user = JSON.parse(rawUser);
      if (user?.role) userRole = user.role;
    }
  } catch {
    // ignore json parse error
  }

  // Session is valid if token exists, sessionActive flag is set, or user is cached in local session
  const isAuthenticated = Boolean(token || sessionActive || user);

  // If route requires auth and user is definitely not logged in
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If route is public-only (e.g., login page) and user IS logged in
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // If roles are specified and user doesn't have the right role
  if (requireAuth && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};
