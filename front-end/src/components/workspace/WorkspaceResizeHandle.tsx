import { Box } from '@mui/material';
import type { KeyboardEventHandler, PointerEventHandler } from 'react';

type Props = {
  direction: 'vertical' | 'horizontal' | 'corner';
  label: string;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onReset: () => void;
  onKeyboardResize: (axis: 'x' | 'y', delta: number) => void;
  onHoverChange?: (hovered: boolean) => void;
  overlay?: boolean;
  position?: number;
  secondaryPosition?: number;
  crossStart?: number;
  valueNow?: number;
  valueMin?: number;
  valueMax?: number;
};

export const getKeyboardResizeAction = (direction: Props['direction'], key: string): readonly ['x' | 'y', number] | null => {
  const resize = key === 'ArrowLeft'
    ? ['x', -1] as const
    : key === 'ArrowRight'
      ? ['x', 1] as const
      : key === 'ArrowUp'
        ? ['y', -1] as const
        : key === 'ArrowDown'
          ? ['y', 1] as const
          : null;
  if (!resize) return null;
  if (direction === 'corner') return resize;
  return direction === 'vertical' && resize[0] === 'x' || direction === 'horizontal' && resize[0] === 'y' ? resize : null;
};

export default function WorkspaceResizeHandle({ direction, label, onPointerDown, onReset, onKeyboardResize, onHoverChange, overlay = false, position, secondaryPosition, crossStart = 0, valueNow, valueMin, valueMax }: Props) {
  const vertical = direction === 'vertical';
  const corner = direction === 'corner';
  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    const resize = getKeyboardResizeAction(direction, event.key);
    if (resize) {
      event.preventDefault();
      onKeyboardResize(resize[0], resize[1]);
    } else if (event.key === 'Home' || event.key === 'Enter') {
      event.preventDefault();
      onReset();
    }
  };

  return <Box role={corner ? 'button' : 'separator'} tabIndex={0} aria-orientation={corner ? undefined : vertical ? 'vertical' : 'horizontal'} aria-label={label} aria-valuenow={corner ? undefined : valueNow} aria-valuemin={corner ? undefined : valueMin} aria-valuemax={corner ? undefined : valueMax} title={label} onPointerDown={onPointerDown} onDoubleClick={onReset} onKeyDown={handleKeyDown} onPointerEnter={() => onHoverChange?.(true)} onPointerLeave={() => onHoverChange?.(false)} sx={{ flex: overlay ? undefined : '0 0 10px', width: corner ? 24 : vertical ? 16 : overlay ? `calc(${100 - crossStart}% + 8px)` : 10, height: corner ? 24 : vertical ? overlay ? '100%' : 'auto' : 16, mx: !overlay && vertical ? '-8px' : 0, cursor: corner ? 'nwse-resize' : vertical ? 'col-resize' : 'row-resize', touchAction: 'none', position: overlay ? 'absolute' : 'relative', zIndex: corner ? 4 : 3, left: overlay && (vertical || corner) ? `calc(${position ?? 0}% - ${corner ? 12 : 8}px)` : overlay && !vertical ? `calc(${crossStart}% - 8px)` : undefined, top: overlay && (corner || !vertical) ? `calc(${corner ? secondaryPosition ?? 0 : position ?? 0}% - ${corner ? 12 : 8}px)` : 0, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }} />;
}
