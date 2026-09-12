import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Portal, Snackbar } from '@mui/material';
import type { AlertColor } from '@mui/material';

type NotificationOptions = {
  severity?: AlertColor;
  duration?: number;
};

type QueuedNotification = Required<NotificationOptions> & {
  id: number;
  message: string;
};

type NotificationContextValue = {
  notify: (message: string, options?: NotificationOptions) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
let nextNotificationId = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  const [open, setOpen] = useState(false);
  const current = queue[0];

  const notify = useCallback((message: string, options: NotificationOptions = {}) => {
    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) return;
    setQueue((items) => [...items, {
      id: ++nextNotificationId,
      message: normalizedMessage,
      severity: options.severity ?? 'info',
      duration: options.duration ?? 5000,
    }]);
    setOpen(true);
  }, []);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const handleExited = () => {
    setQueue((items) => {
      const remaining = items.slice(1);
      setOpen(remaining.length > 0);
      return remaining;
    });
  };

  const value = useMemo(() => ({ notify }), [notify]);

  return <NotificationContext.Provider value={value}>
    {children}
    <Portal>
      <Snackbar
        key={current?.id}
        open={Boolean(current) && open}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={current?.duration}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
        sx={{
          bottom: { xs: 'calc(84px + env(safe-area-inset-bottom))', sm: 24 },
          maxWidth: { xs: 'calc(100vw - 24px)', sm: 560 },
        }}
      >
        {current ? <Alert onClose={handleClose} severity={current.severity} variant="standard" sx={{ width: '100%', border: 1, borderColor: 'divider' }}>
          {current.message}
        </Alert> : <span />}
      </Snackbar>
    </Portal>
  </NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
}
