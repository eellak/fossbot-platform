import {
  clearLocalCompatibleSettings,
  localCompatibleEndpoint,
  readLocalCompatibleSecret,
  readLocalCompatibleSettings,
  saveLocalCompatibleSettings,
} from './deviceSettings';


declare const afterEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;


describe('user-local device settings', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps the endpoint locally and the credential in session storage only', () => {
    saveLocalCompatibleSettings(7, { baseUrl: 'http://127.0.0.1:11434/v1/', model: 'local-model' }, 'temporary-key');
    expect(readLocalCompatibleSettings(7)).toEqual({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'local-model' });
    expect(readLocalCompatibleSecret(7)).toBe('temporary-key');
    expect(JSON.stringify(localStorage)).not.toContain('temporary-key');
    clearLocalCompatibleSettings(7);
    expect(readLocalCompatibleSettings(7)).toBeNull();
    expect(readLocalCompatibleSecret(7)).toBe('');
  });

  it('rejects credentials and escaping paths', () => {
    expect(() => saveLocalCompatibleSettings(7, { baseUrl: 'https://user:pass@example.test/v1', model: 'model' }, '')).toThrow('local_endpoint_invalid');
    expect(() => localCompatibleEndpoint('http://127.0.0.1:11434/v1', '../admin')).toThrow('local_endpoint_invalid');
  });
});
