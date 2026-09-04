import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';
import { UserRole } from 'src/authentication/AuthInterfaces';

interface RoleBasedRouteProps {
  children: ReactNode;
  roles?: string[];
  betaTesterOnly?: boolean;
}

const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ children, roles, betaTesterOnly }) => {
  const { user, authStatus } = useAuth();

  if (authStatus === 'loading') {
    return null;
  }

  if (!user || authStatus !== 'authenticated') {
    return <Navigate to="/auth/login" />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (betaTesterOnly && !user.beta_tester && user.role != UserRole.ADMIN) {
    return <Navigate to="/auth/403" />;
  }

  return <>{children}</>;
};

export default RoleBasedRoute;
