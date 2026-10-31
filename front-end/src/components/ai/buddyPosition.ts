/** Offset of the floating Buddy box from the right/bottom viewport edge. */
export type BuddyPosition = { right: number; bottom: number };

/** Corner presets for sticking the closed button somewhere without dragging. */
export type BuddyCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export const BUDDY_CORNERS: BuddyCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** MUI Fab size, which is what a preset anchors because that is the closed box. */
export const BUDDY_FAB_SIZE = 56;

/** Gap kept between the floating Buddy box and the viewport edge. */
export const BUDDY_MARGIN = 8;

// Shared across Buddy mounts in this tab, but reset by a full page reload.
let currentBuddyPosition: BuddyPosition | null = null;

export function getBuddyPosition(): BuddyPosition | null {
  return currentBuddyPosition;
}

export function setCurrentBuddyPosition(position: BuddyPosition): void {
  currentBuddyPosition = position;
}

/**
 * Keeps a stored right/bottom offset on screen for the given box size. A box
 * larger than the viewport pins to the margin instead of going negative.
 */
export function clampBuddyPosition(
  position: BuddyPosition,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): BuddyPosition {
  const axis = (value: number, box: number, extent: number) =>
    Math.min(Math.max(value, BUDDY_MARGIN), Math.max(BUDDY_MARGIN, extent - box - BUDDY_MARGIN));
  return {
    right: axis(position.right, size.width, viewport.width),
    bottom: axis(position.bottom, size.height, viewport.height),
  };
}

/** Offsets that stick the closed button to one viewport corner. */
export function buddyCornerPosition(
  corner: BuddyCorner,
  viewport: { width: number; height: number },
  size: number = BUDDY_FAB_SIZE,
): BuddyPosition {
  const onLeft = corner.endsWith('left');
  const onTop = corner.startsWith('top');
  return {
    right: Math.max(BUDDY_MARGIN, onLeft ? viewport.width - size - BUDDY_MARGIN : BUDDY_MARGIN),
    bottom: Math.max(BUDDY_MARGIN, onTop ? viewport.height - size - BUDDY_MARGIN : BUDDY_MARGIN),
  };
}
