import { clampBuddyPosition, readBuddyPosition, saveBuddyPosition, buddyCornerPosition, BUDDY_CORNERS, BUDDY_MARGIN, BUDDY_POSITION_KEY } from './buddyPosition';

declare const describe: any;
declare const expect: any;
declare const it: any;

const viewport = { width: 1200, height: 800 };
const fab = { width: 56, height: 56 };

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

describe('readBuddyPosition / saveBuddyPosition', () => {
  const storage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  };

  it('round-trips a saved position', () => {
    const store = storage();
    saveBuddyPosition({ right: 40, bottom: 80 }, store);
    expect(store.getItem(BUDDY_POSITION_KEY)).toBe('{"right":40,"bottom":80}');
    expect(readBuddyPosition(store)).toEqual({ right: 40, bottom: 80 });
  });

  it('ignores missing or malformed values instead of throwing', () => {
    const store = storage();
    expect(readBuddyPosition(store)).toBeNull();
    store.setItem(BUDDY_POSITION_KEY, 'not json');
    expect(readBuddyPosition(store)).toBeNull();
    store.setItem(BUDDY_POSITION_KEY, '{"right":"20"}');
    expect(readBuddyPosition(store)).toBeNull();
  });

  it('survives unavailable storage', () => {
    expect(readBuddyPosition(undefined)).toBeNull();
    expect(() => saveBuddyPosition({ right: 1, bottom: 1 }, undefined)).not.toThrow();
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
