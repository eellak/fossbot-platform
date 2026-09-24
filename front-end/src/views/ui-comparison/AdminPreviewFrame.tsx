import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import FullLayout from 'src/layouts/full/FullLayout';
import { useAuth } from 'src/authentication/AuthProvider';
import { UserRole } from 'src/authentication/AuthInterfaces';
import { useDispatch } from 'src/store/Store';
import { setDarkMode } from 'src/store/customizer/CustomizerSlice';

// Development-only iframe frame for the admin comparison. The parent comparison page
// dispatches the color mode through the query string and postMessage, exactly like the
// dashboard comparison, but this frame renders the production theme and shell.
export default function AdminPreviewFrame() {
  const [params] = useSearchParams();
  const dispatch = useDispatch();
  const auth = useAuth();
  const initialMode = params.get('mode') === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    dispatch(setDarkMode(initialMode));
  }, [dispatch, initialMode]);

  useEffect(() => {
    const handleComparisonMode = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== 'ui-comparison-mode') return;
      dispatch(setDarkMode(event.data.mode === 'dark' ? 'dark' : 'light'));
    };
    window.addEventListener('message', handleComparisonMode);
    return () => window.removeEventListener('message', handleComparisonMode);
  }, [dispatch]);

  if (auth.user?.role !== UserRole.ADMIN) return <Navigate to="/dashboard" replace />;

  return <FullLayout />;
}
