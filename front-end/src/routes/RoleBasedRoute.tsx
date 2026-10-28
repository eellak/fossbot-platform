import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';
import { GuestView, UserRole } from 'src/authentication/AuthInterfaces';
import { guestCanView, guestLandingPath } from 'src/authentication/guest';

interface RoleBasedRouteProps {
  children: ReactNode;
  roles?: string[];
  betaTesterOnly?: boolean;
  guestView?: GuestView;
  guestViews?: GuestView[];
}

const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ children, roles, betaTesterOnly, guestView, guestViews }) => {
  const { user, authStatus, isGuest, guestSettings } = useAuth();

  if (authStatus === 'loading') {
    return null;
  }

  if (isGuest) {
    const views = guestViews?.length ? guestViews : guestView ? [guestView] : [];
    if (!views.length || !views.some((view) => guestCanView(guestSettings, view))) {
      return <Navigate to={guestLandingPath(guestSettings)} replace />;
    }
    return <>{children}</>;
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
