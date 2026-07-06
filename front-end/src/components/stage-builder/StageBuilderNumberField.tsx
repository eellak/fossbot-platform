import React from 'react';
import { TextField, type TextFieldProps } from '@mui/material';

const DRAG_START_THRESHOLD_PX = 3;
const PIXELS_PER_STEP = 8;

type NumberFieldDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  startValue: number;
  axis: 'x' | 'y' | null;
  active: boolean;
  lastValue: number;
  target: HTMLInputElement;
  lockElement: HTMLElement;
  pointerLockRequested: boolean;
  bodyCursor: string;
  bodyUserSelect: string;
};

type NativeInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  [key: string]: unknown;
};

type PointerLockElement = HTMLElement & {
  requestPointerLock?: () => void | Promise<void>;
};

export type StageBuilderNumberFieldProps = Omit<TextFieldProps, 'type'> & {
  type?: TextFieldProps['type'];
  value: number;
};

function numericAttribute(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stepFromInputProps(inputProps?: NativeInputProps): number {
  const step = numericAttribute(inputProps?.step);
  return step && step > 0 ? step : 0.1;
}

function decimalPlaces(value: number): number {
  const text = value.toString().toLowerCase();
  if (!text.includes('e')) return text.includes('.') ? text.split('.')[1].length : 0;

  const [coefficient, exponentText] = text.split('e');
  const exponent = Number(exponentText);
  const coefficientDecimals = coefficient.includes('.') ? coefficient.split('.')[1].length : 0;
  return Math.max(0, coefficientDecimals - exponent);
}

function roundedForStep(value: number, step: number): number {
  const precision = Math.min(6, Math.max(2, decimalPlaces(step) + 2));
  return Number(value.toFixed(precision));
}

function clamped(value: number, inputProps?: NativeInputProps): number {
  const min = numericAttribute(inputProps?.min);
  const max = numericAttribute(inputProps?.max);
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

function makeChangeEvent(value: number): React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> {
  const valueString = String(value);
  return {
    target: { value: valueString },
    currentTarget: { value: valueString },
  } as React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
}

function restoreBodyDragStyles(state: NumberFieldDragState) {
  document.body.style.cursor = state.bodyCursor;
  document.body.style.userSelect = state.bodyUserSelect;
}

export function StageBuilderNumberField({ inputProps, onChange, disabled, InputProps, sx, ...props }: StageBuilderNumberFieldProps) {
  const dragRef = React.useRef<NumberFieldDragState | null>(null);
  const blockClickRef = React.useRef(false);
  const finishDragRef = React.useRef<(preventClick: boolean, exitPointerLock?: boolean) => void>(() => {});
  const inputPropsRef = React.useRef<NativeInputProps>({});
  const onChangeRef = React.useRef<typeof onChange>(onChange);
  const nativeInputProps = (inputProps || {}) as NativeInputProps;
  const readOnly = InputProps?.readOnly || nativeInputProps.readOnly;
  const canDrag = !disabled && !readOnly && !!onChange;

  inputPropsRef.current = nativeInputProps;
  onChangeRef.current = onChange;

  const emitValue = React.useCallback((value: number) => {
    onChangeRef.current?.(makeChangeEvent(value));
  }, []);

  const requestPointerLock = React.useCallback((lockElement: HTMLElement) => {
    const request = (lockElement as PointerLockElement).requestPointerLock;
    if (!request) return;

    try {
      const result = request.call(lockElement) as unknown;
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>)
          .then(() => {
            if (dragRef.current?.lockElement !== lockElement && document.pointerLockElement === lockElement) document.exitPointerLock();
          })
          .catch(() => {});
      }
    } catch {
      // Browsers may deny pointer lock outside supported contexts; normal drag still works.
    }
  }, []);

  const handleDocumentMouseMove = React.useCallback((event: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (document.pointerLockElement === drag.lockElement) {
      drag.deltaX += event.movementX || 0;
      drag.deltaY += event.movementY || 0;
    } else {
      drag.deltaX = event.clientX - drag.startX;
      drag.deltaY = event.clientY - drag.startY;
    }

    if (!drag.active) {
      if (Math.hypot(drag.deltaX, drag.deltaY) < DRAG_START_THRESHOLD_PX) return;
      drag.active = true;
      drag.axis = Math.abs(drag.deltaX) >= Math.abs(drag.deltaY) ? 'x' : 'y';
      document.body.style.cursor = 'none';
      if (!drag.pointerLockRequested) {
        drag.pointerLockRequested = true;
        requestPointerLock(drag.lockElement);
      }
    }

    event.preventDefault();
    const step = stepFromInputProps(inputPropsRef.current);
    const movement = drag.axis === 'x' ? drag.deltaX : -drag.deltaY;
    const nextValue = clamped(roundedForStep(drag.startValue + (movement / PIXELS_PER_STEP) * step, step), inputPropsRef.current);

    if (nextValue !== drag.lastValue) {
      drag.lastValue = nextValue;
      emitValue(nextValue);
    }
  }, [emitValue, requestPointerLock]);

  const handleDocumentMouseUp = React.useCallback((event: MouseEvent) => {
    const active = dragRef.current?.active === true;
    finishDragRef.current(active);
    if (active) event.preventDefault();
  }, []);

  const handlePointerLockChange = React.useCallback(() => {
    const drag = dragRef.current;
    if (!drag || document.pointerLockElement === drag.lockElement || !drag.active) return;
    finishDragRef.current(true, false);
  }, []);

  const finishDrag = React.useCallback((preventClick: boolean, exitPointerLock = true) => {
    const drag = dragRef.current;
    if (!drag) return;

    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);
    document.removeEventListener('pointerlockchange', handlePointerLockChange);
    restoreBodyDragStyles(drag);
    dragRef.current = null;

    if (drag.target.hasPointerCapture?.(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
    if (exitPointerLock && document.pointerLockElement === drag.lockElement) document.exitPointerLock();

    if (preventClick) {
      blockClickRef.current = true;
      window.setTimeout(() => { blockClickRef.current = false; }, 0);
    }
  }, [handleDocumentMouseMove, handleDocumentMouseUp, handlePointerLockChange]);

  React.useEffect(() => {
    finishDragRef.current = finishDrag;
  }, [finishDrag]);

  React.useEffect(() => () => {
    finishDragRef.current(false);
  }, []);

  const handlePointerDown: React.PointerEventHandler<HTMLInputElement> = (event) => {
    nativeInputProps.onPointerDown?.(event);
    if (event.defaultPrevented || !canDrag || event.button !== 0) return;

    finishDragRef.current(false);

    const target = event.currentTarget;
    const lockElement = target.ownerDocument.body || target.ownerDocument.documentElement;
    const startValue = numericAttribute(target.value) ?? numericAttribute(props.value) ?? 0;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      startValue,
      axis: null,
      active: false,
      lastValue: startValue,
      target,
      lockElement,
      pointerLockRequested: false,
      bodyCursor: document.body.style.cursor,
      bodyUserSelect: document.body.style.userSelect,
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    target.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = 'none';
  };

  const handlePointerUp: React.PointerEventHandler<HTMLInputElement> = (event) => {
    nativeInputProps.onPointerUp?.(event);
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const active = dragRef.current.active;
    finishDragRef.current(active);
    if (active) event.preventDefault();
  };

  const handlePointerCancel: React.PointerEventHandler<HTMLInputElement> = (event) => {
    nativeInputProps.onPointerCancel?.(event);
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.active && drag.pointerLockRequested) return;
    finishDragRef.current(drag.active);
  };

  const handleLostPointerCapture: React.PointerEventHandler<HTMLInputElement> = (event) => {
    nativeInputProps.onLostPointerCapture?.(event);
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.active) return;
    finishDragRef.current(false);
  };

  const handleClick: React.MouseEventHandler<HTMLInputElement> = (event) => {
    nativeInputProps.onClick?.(event);
    if (!blockClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const textFieldProps = {
    ...props,
    type: 'number',
    disabled,
    onChange,
    InputProps,
    sx,
    inputProps: {
      ...nativeInputProps,
      title: nativeInputProps.title || (canDrag ? 'Drag left/right or up/down to adjust' : undefined),
      style: {
        ...nativeInputProps.style,
        cursor: canDrag ? nativeInputProps.style?.cursor || 'ew-resize' : nativeInputProps.style?.cursor,
        touchAction: canDrag ? 'none' : nativeInputProps.style?.touchAction,
      },
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onLostPointerCapture: handleLostPointerCapture,
      onClick: handleClick,
    },
  } as TextFieldProps;

  return <TextField {...textFieldProps} />;
}
