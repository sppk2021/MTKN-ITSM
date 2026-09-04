import React from "react";
import { Navigate } from "react-router-dom";
import { TabKey, UserPermissions, DEFAULT_ROLE_PERMISSIONS, UserRole } from "../types";

interface PermissionGuardProps {
  userRole: string;
  tabKey?: TabKey;
  action?: 'view' | 'edit' | 'delete';
  userPermissions?: UserPermissions;
  allowedRoles?: string[];
  children: React.ReactNode;
  fallbackPath?: string;
}

/**
 * PermissionGuard secures routes and components on the client-side.
 * It checks the current user's role and granular tab permissions (view, edit, delete).
 * If unauthorized, it redirects the user to a secure fallback path (defaulting to the Dashboard).
 */
export function PermissionGuard({ 
  userRole, 
  tabKey,
  action = 'view',
  userPermissions,
  allowedRoles, 
  children, 
  fallbackPath = "/" 
}: PermissionGuardProps) {
  // Admin always has full access
  if (userRole === "admin") {
    return <>{children}</>;
  }

  // Check granular tab permissions if tabKey is provided
  if (tabKey) {
    const effectivePermissions = userPermissions || (DEFAULT_ROLE_PERMISSIONS[userRole as UserRole] ?? DEFAULT_ROLE_PERMISSIONS.staff);
    const tabPerm = effectivePermissions[tabKey];
    if (tabPerm && tabPerm[action]) {
      return <>{children}</>;
    }
    return <Navigate to={userRole === 'guest' ? '/login' : fallbackPath} replace />;
  }

  // Fallback to allowedRoles if provided
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to={userRole === 'guest' ? '/login' : fallbackPath} replace />;
  }
  
  return <>{children}</>;
}

