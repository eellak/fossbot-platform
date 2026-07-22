import React, { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../authentication/AuthProvider';

interface PrivateRouteProps {
  children?: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { token, authStatus } = useAuth();

  if (authStatus === 'loading') {
    return null;
  }
  
  if (!token || authStatus !== 'authenticated') {
    return <Navigate to="/auth/login" />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default PrivateRoute;
