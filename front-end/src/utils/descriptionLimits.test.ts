import { clampWords, countWords, DESCRIPTION_MAX_WORDS } from './descriptionLimits';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('description word limits', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('one')).toBe(1);
    expect(countWords('  one   two\nthree\tfour ')).toBe(4);
  });

  it('leaves descriptions inside the limit untouched', () => {
    const value = 'a '.repeat(DESCRIPTION_MAX_WORDS - 1) + 'end';
    expect(clampWords(value)).toBe(value);
  });

  it('cuts a description at the word limit', () => {
    const value = Array.from({ length: DESCRIPTION_MAX_WORDS + 5 }, (_, index) => `w${index + 1}`).join(' ');
    const clamped = clampWords(value);
    expect(countWords(clamped)).toBe(DESCRIPTION_MAX_WORDS);
    expect(clamped.endsWith(`w${DESCRIPTION_MAX_WORDS}`)).toBe(true);
    expect(clamped).not.toContain(`w${DESCRIPTION_MAX_WORDS + 1}`);
  });

  it('honours a custom limit and keeps inner spacing', () => {
    expect(clampWords('one   two three four', 2)).toBe('one   two');
    expect(clampWords('one\ntwo\nthree', 2)).toBe('one\ntwo');
  });
});
