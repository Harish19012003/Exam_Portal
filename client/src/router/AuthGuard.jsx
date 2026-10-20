import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * AuthGuard component wraps routes that require authentication.
 * Checks for token and redirects to login if unauthenticated.
 */
export const AuthGuard = ({ requireAuth = true, allowedRoles = [] }) => {
  const token = localStorage.getItem('accessToken');
  let userRole = 'admin';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role) userRole = user.role;
  } catch {
    // ignore json parse error
  }

  // If route requires auth and user is not logged in
  if (requireAuth && !token) {
    return <Navigate to="/login" replace />;
  }

  // If route is public-only (e.g., login page) and user IS logged in
  if (!requireAuth && token) {
    return <Navigate to="/dashboard" replace />;
  }

  // If roles are specified and user doesn't have the right role
  if (requireAuth && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};
