import React from "react";
import { Navigate } from "react-router-dom";

interface PermissionGuardProps {
  userRole: string;
  allowedRoles: string[];
  children: React.ReactNode;
  fallbackPath?: string;
}

/**
 * PermissionGuard secures routes on the client-side.
 * It checks the current user's role against a list of allowed roles.
 * If unauthorized, it redirects the user to a secure fallback path (defaulting to the Dashboard).
 */
export function PermissionGuard({ 
  userRole, 
  allowedRoles, 
  children, 
  fallbackPath = "/" 
}: PermissionGuardProps) {
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={fallbackPath} replace />;
  }
  
  return <>{children}</>;
}
