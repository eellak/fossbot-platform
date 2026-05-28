import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';
const AdminRoute = () => {
  const auth = useAuth();
  const token = auth.token;
  const user = auth.user;

  if (auth.authStatus === 'loading') {
    return null;
  }

  if (!token || auth.authStatus !== 'authenticated') {
    return <Navigate to="/auth/login" />;
  }

  if (!user || user.role != "admin") {
    return <Navigate to="/dashboard" />;
  }

  return <Outlet />;
};

export default AdminRoute;
