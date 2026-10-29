import React, { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';
import { guestLandingPath } from '../authentication/guest';
import { rememberAuthReturnPath } from '../authentication/authReturn';

interface PrivateRouteProps {
  children?: ReactNode;
  guestAllowed?: boolean;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, guestAllowed = false }) => {
  const { token, authStatus, isGuest, guestSettings } = useAuth();
  const location = useLocation();

  if (authStatus === 'loading') {
    return null;
  }
  
  if (!token || authStatus !== 'authenticated') {
    rememberAuthReturnPath(`${location.pathname}${location.search}`);
    return <Navigate to="/auth/login" />;
  }

  if (isGuest && (!guestAllowed || !guestSettings.allowed_views.length)) {
    return <Navigate to={guestLandingPath(guestSettings)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default PrivateRoute;
