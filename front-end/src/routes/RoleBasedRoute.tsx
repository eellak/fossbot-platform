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
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
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
