import { resolveAssetUrlFor, resolveBackendUrlFor } from './backendUrl';

declare const describe: any;
declare const expect: any;
declare const it: any;

describe('backend URL resolution', () => {
    it('keeps relative API paths untouched', () => {
        expect(resolveBackendUrlFor('/api', '192.168.1.50')).toBe('/api');
    });

    it('rewrites a loopback backend to the host serving the page', () => {
        expect(resolveBackendUrlFor('http://localhost:8000', '192.168.1.50')).toBe('http://192.168.1.50:8000');
        expect(resolveBackendUrlFor('http://127.0.0.1:8000', 'fossbot.local')).toBe('http://fossbot.local:8000');
    });

    it('keeps loopback when the page is also served from loopback', () => {
        expect(resolveBackendUrlFor('http://localhost:8000', 'localhost')).toBe('http://localhost:8000');
        expect(resolveBackendUrlFor('http://localhost:8000', '127.0.0.1')).toBe('http://localhost:8000');
    });

    it('does not touch a non-loopback backend', () => {
        expect(resolveBackendUrlFor('https://api.fossbot.gr', '192.168.1.50')).toBe('https://api.fossbot.gr');
    });

    it('trims a trailing slash', () => {
        expect(resolveBackendUrlFor('http://localhost:8000/', 'localhost')).toBe('http://localhost:8000');
    });
});

describe('backend asset URL resolution', () => {
    it('rewrites loopback preview URLs through the LAN backend base', () => {
        expect(resolveAssetUrlFor('http://localhost:8000/api/local-stages/7/preview?v=2', 'http://192.168.1.50:8000', 'http://192.168.1.50:3000'))
            .toBe('http://192.168.1.50:8000/api/local-stages/7/preview?v=2');
        expect(resolveAssetUrlFor('http://127.0.0.1:8000/api/marketplace/record', 'http://192.168.1.50:8000', 'http://192.168.1.50:3000'))
            .toBe('http://192.168.1.50:8000/api/marketplace/record');
    });

    it('keeps same-machine loopback assets unchanged', () => {
        expect(resolveAssetUrlFor('http://localhost:8000/api/local-stages/1/preview', 'http://localhost:8000', 'http://localhost:3000'))
            .toBe('http://localhost:8000/api/local-stages/1/preview');
    });

    it('re-applies the production gateway prefix for loopback assets', () => {
        // Behind nginx, browser `/api/*` maps to backend `/*`, so the backend
        // route `/api/local-stages/...` must be fetched as `/api/api/...`.
        expect(resolveAssetUrlFor('http://localhost:8000/api/local-stages/5/preview?v=4', '/api', 'https://fossbot.gr'))
            .toBe('/api/api/local-stages/5/preview?v=4');
        expect(resolveAssetUrlFor('http://localhost:8000/api/local-marketplace/publications/3/preview', '/api', 'https://fossbot.gr'))
            .toBe('/api/api/local-marketplace/publications/3/preview');
    });

    it('leaves correctly configured production backend URLs unchanged', () => {
        const configured = 'https://fossbot.gr/api/api/local-stages/5/preview?v=4';
        expect(resolveAssetUrlFor(configured, '/api', 'https://fossbot.gr')).toBe(configured);
    });

    it('does not rewrite external asset URLs', () => {
        const raw = 'https://raw.githubusercontent.com/fossbot/marketplace/main/stages/demo/preview.png';
        expect(resolveAssetUrlFor(raw, '/api', 'https://fossbot.gr')).toBe(raw);
        expect(resolveAssetUrlFor(raw, 'http://192.168.1.50:8000', 'http://192.168.1.50:3000')).toBe(raw);
    });
});
