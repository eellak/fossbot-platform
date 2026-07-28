import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface FeatureFlags {
  marketplace: boolean;
  ready: boolean;
}

const defaultFlags: FeatureFlags = { marketplace: false, ready: false };
const FeatureFlagsContext = createContext<FeatureFlags>(defaultFlags);
const backendUrl: string = process.env.REACT_APP_BACKEND_URL;

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${backendUrl}/api/features`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload) => {
        if (!controller.signal.aborted) setFlags({ marketplace: payload?.marketplace === true, ready: true });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn('[features] failed to load runtime feature flags', error);
          setFlags({ ...defaultFlags, ready: true });
        }
      });
    return () => controller.abort();
  }, []);

  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext);
}
