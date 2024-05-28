import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';
import { User } from 'src/authentication/AuthInterfaces';

const AdminRoute = () => {
  const auth = useAuth();
  const token = auth.token;
  const user: User = auth.user;

  if (!token) {
    return <Navigate to="/auth/login" />;
  }

  if (user != null) {
    console.log(user)
    if (user.role != "admin")
      return <Navigate to="/dashboard" />;
  }
  return <Outlet />;
};

export default AdminRoute;
