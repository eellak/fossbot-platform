import { clampBuddyPosition, buddyCornerPosition, BUDDY_CORNERS, BUDDY_MARGIN } from './buddyPosition';

declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

const viewport = { width: 1200, height: 800 };
const fab = { width: 56, height: 56 };

it('keeps the position across Buddy mounts but resets it in a new page runtime', () => {
  jest.isolateModules(() => {
    const position = require('./buddyPosition') as typeof import('./buddyPosition');
    expect(position.getBuddyPosition()).toBeNull();
    position.setCurrentBuddyPosition({ right: 80, bottom: 120 });
    expect(position.getBuddyPosition()).toEqual({ right: 80, bottom: 120 });
    position.clampBuddyPosition(position.getBuddyPosition()!, fab, { width: 100, height: 100 });
    expect(position.getBuddyPosition()).toEqual({ right: 80, bottom: 120 });
  });
  jest.isolateModules(() => {
    const position = require('./buddyPosition') as typeof import('./buddyPosition');
    expect(position.getBuddyPosition()).toBeNull();
  });
});

describe('clampBuddyPosition', () => {
  it('leaves a position that already fits untouched', () => {
    expect(clampBuddyPosition({ right: 20, bottom: 20 }, fab, viewport)).toEqual({ right: 20, bottom: 20 });
  });

  it('pulls a box dragged past the edges back onto the viewport', () => {
    expect(clampBuddyPosition({ right: -300, bottom: -400 }, fab, viewport)).toEqual({
      right: BUDDY_MARGIN,
      bottom: BUDDY_MARGIN,
    });
    expect(clampBuddyPosition({ right: 5000, bottom: 5000 }, fab, viewport)).toEqual({
      right: viewport.width - fab.width - BUDDY_MARGIN,
      bottom: viewport.height - fab.height - BUDDY_MARGIN,
    });
  });

  it('pins a box wider than the viewport to the margin', () => {
    expect(clampBuddyPosition({ right: 300, bottom: 300 }, { width: 1400, height: 100 }, { width: 400, height: 800 })).toEqual({
      right: BUDDY_MARGIN,
      bottom: 300,
    });
  });
});

describe('buddyCornerPosition', () => {
  const viewport = { width: 1000, height: 700 };

  it('sticks the 56px button to each corner with the drag margin', () => {
    expect(BUDDY_CORNERS.map((corner) => [corner, buddyCornerPosition(corner, viewport)])).toEqual([
      ['top-left', { right: 1000 - 56 - BUDDY_MARGIN, bottom: 700 - 56 - BUDDY_MARGIN }],
      ['top-right', { right: BUDDY_MARGIN, bottom: 700 - 56 - BUDDY_MARGIN }],
      ['bottom-left', { right: 1000 - 56 - BUDDY_MARGIN, bottom: BUDDY_MARGIN }],
      ['bottom-right', { right: BUDDY_MARGIN, bottom: BUDDY_MARGIN }],
    ]);
  });

  it('falls back to the margin when the viewport is smaller than the button', () => {
    expect(buddyCornerPosition('top-left', { width: 40, height: 40 })).toEqual({ right: BUDDY_MARGIN, bottom: BUDDY_MARGIN });
  });
});
