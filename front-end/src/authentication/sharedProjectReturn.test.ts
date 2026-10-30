import { clearSharedReturn, pendingSharedReturn, rememberSharedReturn, validSharedReturn } from './sharedProjectReturn';
declare const it: any, expect: any, afterEach: any, jest: any;
const path = '/shared-projects/' + 'x'.repeat(43);
afterEach(() => { sessionStorage.clear(); jest.restoreAllMocks(); });
it('keeps only exact local shared paths and preserves them for retry', () => {
  for (const value of [null, 'https://evil.test' + path, '//' + path, path + '?next=evil', path + '#x', '/dashboard', '/shared-projects/%2f', path + '/']) {
    expect(validSharedReturn(value)).toBeNull();
    expect(rememberSharedReturn(value)).toBeNull();
  }
  expect(rememberSharedReturn(path)).toBe(path);
  expect(pendingSharedReturn()).toBe(path);
  expect(pendingSharedReturn()).toBe(path);
  clearSharedReturn();
  expect(pendingSharedReturn()).toBeNull();
});
it('returns the validated path for router-state fallback when storage fails', () => {
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(rememberSharedReturn(path)).toBe(path);
  expect(pendingSharedReturn()).toBeNull();
  expect(() => clearSharedReturn()).not.toThrow();
});
