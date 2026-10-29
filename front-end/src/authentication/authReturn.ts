const AUTH_RETURN_KEY = 'fossbot-auth-return';

/** Remember an in-app path so login or guest entry can return to it. */
export function rememberAuthReturnPath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) return;
  try {
    sessionStorage.setItem(AUTH_RETURN_KEY, path);
  } catch {
    // Storage can be unavailable; login still falls back to the default page.
  }
}

/** Read and clear the remembered path, falling back to the default landing page. */
export function takeAuthReturnPath(fallback: string): string {
  try {
    const path = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    return path && path.startsWith('/') && !path.startsWith('//') ? path : fallback;
  } catch {
    return fallback;
  }
}
