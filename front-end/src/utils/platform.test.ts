import { copyText, randomId } from './platform';

declare const describe: any;
declare const expect: any;
declare const it: any;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('platform helpers', () => {
  it('generates a v4-shaped id', () => {
    expect(randomId()).toMatch(uuidPattern);
    expect(new Set(Array.from({ length: 500 }, () => randomId())).size).toBe(500);
  });

  it('still generates an id when crypto.randomUUID is unavailable', () => {
    const cryptoObject = (globalThis as any).crypto;
    const original = cryptoObject?.randomUUID;
    try {
      if (cryptoObject) Object.defineProperty(cryptoObject, 'randomUUID', { value: undefined, configurable: true });
      expect(randomId()).toMatch(uuidPattern);
    } finally {
      if (cryptoObject && original) Object.defineProperty(cryptoObject, 'randomUUID', { value: original, configurable: true });
    }
  });

  it('resolves copy attempts without throwing when the clipboard API is missing', async () => {
    const navigatorObject = (globalThis as any).navigator;
    const original = navigatorObject?.clipboard;
    try {
      if (navigatorObject) Object.defineProperty(navigatorObject, 'clipboard', { value: undefined, configurable: true });
      await expect(copyText('trace')).resolves.toEqual(expect.any(Boolean));
    } finally {
      if (navigatorObject && original) Object.defineProperty(navigatorObject, 'clipboard', { value: original, configurable: true });
    }
  });
});
