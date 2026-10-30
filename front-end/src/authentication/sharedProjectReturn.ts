const KEY = 'fossbot.shared.return.v1';

export function validSharedReturn(value: unknown): string | null {
  return typeof value === 'string' && /^\/shared-projects\/[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function rememberSharedReturn(value: unknown): string | null {
  const path = validSharedReturn(value);
  if (path) {
    try { sessionStorage.setItem(KEY, path); } catch { /* Router state is the fallback. */ }
  }
  return path;
}

export function pendingSharedReturn(): string | null {
  try { return validSharedReturn(sessionStorage.getItem(KEY)); } catch { return null; }
}

export function clearSharedReturn(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* Storage may be disabled. */ }
}
