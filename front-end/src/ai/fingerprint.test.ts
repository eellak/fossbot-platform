import { fingerprintText, fingerprintValue, sha256HexSync, stableStringify } from './fingerprint';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('sha256 fingerprinting', () => {
  it('matches the standard SHA-256 test vectors without Web Crypto', () => {
    expect(sha256HexSync('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256HexSync('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256HexSync('The quick brown fox jumps over the lazy dog')).toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  });

  it('handles padding boundaries and unicode payloads', () => {
    expect(sha256HexSync('a'.repeat(55))).toBe('9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318');
    expect(sha256HexSync('a'.repeat(56))).toBe('b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a');
    expect(sha256HexSync('a'.repeat(1000))).toHaveLength(64);
    // Multi-byte UTF-8 and a surrogate pair (4-byte encoding).
    expect(sha256HexSync('Ελληνικά — {"b":1,"a":[1,2,3]}')).toBe('7fd933b9924e2004de2d720fd91f35bca8238ae6a390ee25a6addcb402cda304');
    expect(sha256HexSync('🤖 FOSSBot')).toBe('df4a4888677ff821d8873326e628db091bb2ce2ba9c7dd39ca50d5456af9a49b');
  });

  it('produces the same fingerprint as the async path for a stable payload', async () => {
    const expected = sha256HexSync('{"a":1,"b":2}');
    await expect(fingerprintText('{"a":1,"b":2}')).resolves.toBe(expected);
    await expect(fingerprintValue({ b: 2, a: 1 })).resolves.toBe(expected);
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });
});
