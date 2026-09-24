/**
 * Longest description we accept on projects, courses, and stages, in words.
 * Cards only show a couple of lines, so keep this short enough that a full
 * description still reads as a summary. Change it here to move the limit for
 * every authoring field.
 */
export const DESCRIPTION_MAX_WORDS = 60;

/** Number of whitespace-separated words in a description. */
export function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Truncates a description to `maxWords`, keeping the original spacing and any
 * trailing whitespace after the last allowed word. Values already inside the
 * limit are returned untouched.
 */
export function clampWords(value: string, maxWords: number = DESCRIPTION_MAX_WORDS): string {
  if (countWords(value) <= maxWords) return value;
  const wordPattern = /\S+/g;
  let match: RegExpExecArray | null;
  let count = 0;
  let end = 0;
  while ((match = wordPattern.exec(value)) !== null) {
    count += 1;
    end = match.index + match[0].length;
    if (count === maxWords) break;
  }
  return value.slice(0, end);
}
