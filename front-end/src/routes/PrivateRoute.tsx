import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';

const PrivateRoute = () => {
  const user = useAuth();
  if (!user.token) return <Navigate to="/auth/login" />;
  return <Outlet />;
};

export default PrivateRoute;
