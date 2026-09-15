import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';

/**
 * Promise-based replacement for window.alert/confirm/prompt.
 *
 * Native dialogs block the thread, ignore the FOSSBot theme, and cannot be styled or tested.
 * This provider renders one themed Material UI Dialog (same structure as the Stage Builder
 * recovery-draft dialog) and resolves the caller's promise when the user answers.
 *
 * Mount `ConfirmDialogProvider` once near the app root, then call `useConfirmDialog()`.
 */

export type ConfirmDialogOptions = {
  title: string;
  /** Body copy. Rendered with `white-space: pre-line`, so `\n` starts a new line. */
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button with the error color. Use when the action destroys user work. */
  danger?: boolean;
  /** Prompt variant only. */
  inputLabel?: string;
  defaultValue?: string;
  /** Prompt variant only: render a fixed-height textarea of this many rows instead of a single-line input, for long values. */
  inputRows?: number;
  /** Prompt variant only: block confirm while the field is empty. */
  inputRequired?: boolean;
  inputRequiredMessage?: string;
};

type ConfirmDialogVariant = 'alert' | 'confirm' | 'prompt';

type ConfirmDialogResult = boolean | string | null;

type PendingRequest = ConfirmDialogOptions & {
  variant: ConfirmDialogVariant;
  resolve: (value: ConfirmDialogResult) => void;
};

type ConfirmDialogContextValue = {
  /** Informational, single-button dialog. Resolves once the user acknowledges it. */
  alert: (options: ConfirmDialogOptions) => Promise<void>;
  /** Two-button dialog. Resolves true on confirm, false on cancel/dismiss. */
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  /** Dialog with one text field. Resolves the entered value, or null on cancel/dismiss. */
  prompt: (options: ConfirmDialogOptions) => Promise<string | null>;
};

/** Cancelled value for a request that is superseded or unmounted before the user answers. */
const dismissValue = (variant: ConfirmDialogVariant): ConfirmDialogResult => {
  if (variant === 'prompt') return null;
  if (variant === 'confirm') return false;
  return true;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [inputValue, setInputValue] = useState('');
  const pendingRef = useRef<PendingRequest | null>(null);

  const openRequest = useCallback((variant: ConfirmDialogVariant, options: ConfirmDialogOptions) => (
    new Promise<ConfirmDialogResult>((resolve) => {
      // A second request while one is open dismisses the first, so no caller awaits forever.
      const previous = pendingRef.current;
      if (previous) previous.resolve(dismissValue(previous.variant));
      const next = { ...options, variant, resolve };
      pendingRef.current = next;
      setInputValue(options.defaultValue ?? '');
      setRequest(next);
    })
  ), []);

  const close = useCallback((value: ConfirmDialogResult) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setRequest(null);
    pending?.resolve(value);
  }, []);

  // Resolve anything still open on unmount so awaited callers do not hang.
  useEffect(() => () => {
    const pending = pendingRef.current;
    if (pending) pending.resolve(dismissValue(pending.variant));
    pendingRef.current = null;
  }, []);

  const value = useMemo<ConfirmDialogContextValue>(() => ({
    alert: (options) => openRequest('alert', options).then(() => undefined),
    confirm: (options) => openRequest('confirm', options).then((result) => result === true),
    prompt: (options) => openRequest('prompt', options).then((result) => (typeof result === 'string' ? result : null)),
  }), [openRequest]);

  const variant = request?.variant ?? 'alert';
  const isPrompt = variant === 'prompt';
  // A long value that must be copied by hand gets a fixed-height textarea so the dialog stays compact.
  const isMultiline = isPrompt && typeof request?.inputRows === 'number';
  const inputInvalid = isPrompt && request?.inputRequired === true && !inputValue.trim();

  const handleConfirm = () => {
    if (!request) return;
    if (isPrompt) {
      if (inputInvalid) return;
      close(inputValue);
      return;
    }
    close(true);
  };

  const handleCancel = () => close(dismissValue(variant));

  return <ConfirmDialogContext.Provider value={value}>
    {children}
    <Dialog
      open={Boolean(request)}
      onClose={handleCancel}
      fullWidth
      maxWidth="sm"
      aria-labelledby="confirm-dialog-title"
    >
      <DialogTitle id="confirm-dialog-title">{request?.title}</DialogTitle>
      <DialogContent>
        {request?.message ? <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{request.message}</Typography> : null}
        {isPrompt ? <TextField
          autoFocus
          fullWidth
          size="small"
          multiline={isMultiline}
          minRows={isMultiline ? request?.inputRows : undefined}
          maxRows={isMultiline ? request?.inputRows : undefined}
          label={request?.inputLabel ?? 'Value'}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          // Long values exist to be copied; selecting them on focus saves a drag or triple-click.
          onFocus={(event) => { if (isMultiline) event.currentTarget.select(); }}
          error={inputInvalid}
          helperText={inputInvalid ? request?.inputRequiredMessage : undefined}
          sx={{ mt: request?.message ? 2 : 0 }}
        /> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        {variant !== 'alert' ? <Button variant="outlined" color="inherit" onClick={handleCancel}>
          {request?.cancelLabel ?? 'Cancel'}
        </Button> : null}
        <Button
          variant="contained"
          color={request?.danger ? 'error' : 'primary'}
          autoFocus={!isPrompt}
          disabled={inputInvalid}
          onClick={handleConfirm}
        >
          {request?.confirmLabel ?? 'OK'}
        </Button>
      </DialogActions>
    </Dialog>
  </ConfirmDialogContext.Provider>;
}

export function useConfirmDialog(): ConfirmDialogContextValue {
  const context = useContext(ConfirmDialogContext);
  if (!context) throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  return context;
}
