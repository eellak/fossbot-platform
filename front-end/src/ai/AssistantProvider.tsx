import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from 'src/authentication/AuthProvider';
import { readAIAccess } from './AssistantApi';
import type { AIAccessBootstrap, AICapabilityId } from './types';

type AssistantContextValue = {
  access: AIAccessBootstrap | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<AIAccessBootstrap | null>;
  decision: (capability: AICapabilityId) => AIAccessBootstrap['capabilities'][number] | undefined;
};

const AssistantContext = createContext<AssistantContextValue | undefined>(undefined);

export default function AssistantProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [access, setAccess] = useState<AIAccessBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!token) { setAccess(null); return null; }
    setLoading(true); setError('');
    try {
      const result = await readAIAccess(token);
      setAccess(result);
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI access could not be loaded');
      return null;
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);
  const value = useMemo<AssistantContextValue>(() => ({
    access,
    loading,
    error,
    refresh,
    decision: (capability) => access?.capabilities.find((item) => item.capability === capability),
  }), [access, error, loading, refresh]);
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistantAccess() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error('useAssistantAccess must be used within AssistantProvider');
  return context;
}
