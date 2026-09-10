import { getKeyboardResizeAction } from './WorkspaceResizeHandle';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('WorkspaceResizeHandle keyboard controls', () => {
  it('maps arrow keys to the separator axis', () => {
    expect(getKeyboardResizeAction('vertical', 'ArrowLeft')).toEqual(['x', -1]);
    expect(getKeyboardResizeAction('vertical', 'ArrowDown')).toBeNull();
    expect(getKeyboardResizeAction('horizontal', 'ArrowDown')).toEqual(['y', 1]);
    expect(getKeyboardResizeAction('corner', 'ArrowUp')).toEqual(['y', -1]);
  });
});
