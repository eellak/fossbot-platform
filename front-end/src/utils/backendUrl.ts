// Single source of truth for the backend base URL.
//
// In LAN development the frontend is often opened from another device while the
// API runs beside it on the host computer. A configured `localhost` backend then
// points at the visitor's own machine, so we swap the loopback host for the
// hostname the page was served from. All API clients must use this value instead
// of reading `process.env.REACT_APP_BACKEND_URL` directly.
export const resolveBackendUrlFor = (configuredUrl: string, hostname?: string): string => {
    if (!hostname || configuredUrl.startsWith('/')) {
        return configuredUrl.replace(/\/$/, '');
    }

    try {
        const url = new URL(configuredUrl);
        const frontendIsRemote = hostname !== 'localhost' && hostname !== '127.0.0.1';
        const backendUsesLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

        // During LAN development, localhost in the browser means the visitor's
        // computer. The API is running beside the frontend on the host computer.
        if (frontendIsRemote && backendUsesLoopback) {
            url.hostname = hostname;
        }

        return url.toString().replace(/\/$/, '');
    } catch {
        return configuredUrl.replace(/\/$/, '');
    }
};

export const resolveBackendUrl = (): string =>
    resolveBackendUrlFor(
        process.env.REACT_APP_BACKEND_URL || '/api',
        typeof window !== 'undefined' ? window.location.hostname : undefined,
    );

export const backendUrl = resolveBackendUrl();

// The backend builds absolute URLs for protected assets (stage previews, local
// marketplace records) from FOSSBOT_BACKEND_URL, which falls back to
// `http://localhost:8000` in development. The browser fetches those URLs, so a
// loopback host breaks LAN access exactly like a loopback API base would.
//
// Rewrite loopback assets by routing the backend path through the same API base
// as every other call. This matters behind a gateway that strips a prefix: the
// production nginx maps browser `/api/*` to backend `/*`, so a backend route of
// `/api/local-stages/...` must be fetched as `/api/api/local-stages/...`.
// External URLs (GitHub raw, CDNs) are returned untouched.
export const resolveAssetUrlFor = (assetUrl: string, backendBase: string, origin: string): string => {
    if (!assetUrl) return assetUrl;

    try {
        const parsed = new URL(assetUrl, origin);
        if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
            return assetUrl;
        }

        return `${backendBase.replace(/\/$/, '')}${parsed.pathname}${parsed.search}`;
    } catch {
        return assetUrl;
    }
};

export const resolveBackendAssetUrl = <T extends string | null | undefined>(url: T): T => {
    if (!url || typeof window === 'undefined') {
        return url;
    }
    return resolveAssetUrlFor(url, backendUrl, window.location.origin) as T;
};
