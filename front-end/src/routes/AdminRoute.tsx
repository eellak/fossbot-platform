import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';
import { User } from 'src/authentication/AuthInterfaces';
import { guestLandingPath } from 'src/authentication/guest';

const AdminRoute = () => {
  const auth = useAuth();
  const token = auth.token;
  const user: User = auth.user;

  // Auth is restored from the stored token on a hard load; redirecting during that
  // window sent admin deep links to the login page and then on to the dashboard.
  if (auth.authStatus === 'loading') {
    return null;
  }

  if (!token || auth.authStatus !== 'authenticated') {
    return <Navigate to="/auth/login" />;
  }

  if (auth.isGuest) {
    return <Navigate to={guestLandingPath(auth.guestSettings)} replace />;
  }

  if (user != null && user.role != "admin") {
    return <Navigate to="/dashboard" />;
  }

  return <Outlet />;
};

export default AdminRoute;
