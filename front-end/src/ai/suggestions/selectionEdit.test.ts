import { lineDiff, replaceSelectedLines } from './selectionEdit';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('replaceSelectedLines', () => {
  const source = 'alpha\nbeta\ngamma\ndelta';

  it('replaces one line and preserves the rest', () => {
    expect(replaceSelectedLines(source, { startLine: 2, endLine: 2, endColumn: 5 }, 'BETA')).toBe('alpha\nBETA\ngamma\ndelta');
  });

  it('normalizes a whole-line selection that ends at the next line start', () => {
    expect(replaceSelectedLines(source, { startLine: 2, endLine: 3, endColumn: 1 }, 'BETA')).toBe('alpha\nBETA\ngamma\ndelta');
  });

  it('replaces several lines and trims trailing newlines from the replacement', () => {
    expect(replaceSelectedLines(source, { startLine: 2, endLine: 4, endColumn: 1 }, 'one\ntwo\n')).toBe('alpha\none\ntwo\ndelta');
  });

  it('replaces the first and last lines', () => {
    expect(replaceSelectedLines(source, { startLine: 1, endLine: 1, endColumn: 6 }, 'start')).toBe('start\nbeta\ngamma\ndelta');
    expect(replaceSelectedLines(source, { startLine: 4, endLine: 4, endColumn: 6 }, 'end')).toBe('alpha\nbeta\ngamma\nend');
  });
});

describe('lineDiff', () => {
  it('shows only the changed line', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc')).toEqual({ removed: ['b'], added: ['B'] });
  });

  it('shows added lines', () => {
    expect(lineDiff('a\nc', 'a\nb\nc')).toEqual({ removed: [], added: ['b'] });
  });

  it('returns nothing for identical inputs', () => {
    expect(lineDiff('a\nb', 'a\nb')).toEqual({ removed: [], added: [] });
  });
});
