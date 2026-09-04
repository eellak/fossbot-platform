import React, { createContext, ReactNode, useContext } from 'react';
import { useAuth } from 'src/authentication/AuthProvider';
import { UserRole } from 'src/authentication/AuthInterfaces';

interface FeatureFlags {
  marketplace: boolean;
  ready: boolean;
}

const defaultFlags: FeatureFlags = { marketplace: false, ready: false };
const FeatureFlagsContext = createContext<FeatureFlags>(defaultFlags);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const hasBetaAccess = user?.beta_tester || user?.role === UserRole.ADMIN;
  const flags = { marketplace: Boolean(hasBetaAccess), ready: !token || user !== null };

  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext);
}
