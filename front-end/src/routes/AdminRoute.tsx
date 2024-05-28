import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';
import { User } from 'src/authentication/AuthInterfaces';

const AdminRoute = () => {
  const auth = useAuth();
  const user: User = auth.user;

  if(user != null) {
    if(user.role != "admin")
      return <Navigate to="/auth/login" />;
  }
  return <Outlet />;
};

export default AdminRoute;
