import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';

interface RoleBasedRouteProps {
  children: ReactNode;
  roles?: string[];
  betaTesterOnly?: boolean;
}

const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ children, roles, betaTesterOnly }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/auth/403" />;
  }

  if (betaTesterOnly && !user.beta_tester) {
    return <Navigate to="/auth/403" />;
  }

  return <>{children}</>;
};

export default RoleBasedRoute;
