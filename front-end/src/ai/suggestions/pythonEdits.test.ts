import { applyPythonEdits, previewPythonEdits } from './pythonEdits';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('applyPythonEdits', () => {
  const source = 'alpha\nbeta\ngamma\ndelta';

  it('replaces a single line range', () => {
    expect(applyPythonEdits(source, [{ startLine: 2, endLine: 2, replacement: 'BETA' }])).toBe('alpha\nBETA\ngamma\ndelta');
  });

  it('replaces several lines and can delete the range with an empty replacement', () => {
    expect(applyPythonEdits(source, [{ startLine: 2, endLine: 3, replacement: 'one\ntwo' }])).toBe('alpha\none\ntwo\ndelta');
    expect(applyPythonEdits(source, [{ startLine: 2, endLine: 3, replacement: '' }])).toBe('alpha\ndelta');
  });

  it('applies multiple non-overlapping edits regardless of order', () => {
    expect(applyPythonEdits(source, [
      { startLine: 4, endLine: 4, replacement: 'DELTA' },
      { startLine: 1, endLine: 1, replacement: 'ALPHA' },
    ])).toBe('ALPHA\nbeta\ngamma\nDELTA');
  });

  it('rejects overlapping, inverted, or out-of-range edits', () => {
    expect(() => applyPythonEdits(source, [{ startLine: 3, endLine: 4, replacement: 'x' }, { startLine: 4, endLine: 4, replacement: 'y' }])).toThrow('invalid_suggestion');
    expect(() => applyPythonEdits(source, [{ startLine: 3, endLine: 2, replacement: 'x' }])).toThrow('invalid_suggestion');
    expect(() => applyPythonEdits(source, [{ startLine: 5, endLine: 5, replacement: 'x' }])).toThrow('invalid_suggestion');
  });
});

describe('previewPythonEdits', () => {
  const source = 'alpha\nbeta\ngamma\ndelta';

  it('keeps each edit range separate with its own before/after lines', () => {
    expect(previewPythonEdits(source, [
      { startLine: 1, endLine: 1, replacement: 'ALPHA' },
      { startLine: 3, endLine: 4, replacement: 'one\ntwo' },
    ])).toEqual([
      { startLine: 1, endLine: 1, before: ['alpha'], after: ['ALPHA'] },
      { startLine: 3, endLine: 4, before: ['gamma', 'delta'], after: ['one', 'two'] },
    ]);
  });

  it('marks a deletion with an empty after list', () => {
    expect(previewPythonEdits(source, [{ startLine: 2, endLine: 3, replacement: '' }])).toEqual([
      { startLine: 2, endLine: 3, before: ['beta', 'gamma'], after: [] },
    ]);
  });
});
