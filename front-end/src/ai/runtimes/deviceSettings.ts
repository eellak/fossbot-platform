export type LocalCompatibleSettings = {
  baseUrl: string;
  model: string;
};

const settingsKey = (providerId: number) => `fossbot.ai.local.${providerId}.v1`;
const secretKey = (providerId: number) => `fossbot.ai.local.${providerId}.secret.v1`;

export function readLocalCompatibleSettings(providerId: number): LocalCompatibleSettings | null {
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey(providerId)) || 'null');
    return typeof value?.baseUrl === 'string' && typeof value?.model === 'string' ? value : null;
  } catch { return null; }
}

export function saveLocalCompatibleSettings(providerId: number, value: LocalCompatibleSettings, apiKey: string) {
  const url = new URL(value.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('local_endpoint_invalid');
  localStorage.setItem(settingsKey(providerId), JSON.stringify({ baseUrl: url.toString().replace(/\/$/, ''), model: value.model.trim() }));
  if (apiKey) sessionStorage.setItem(secretKey(providerId), apiKey);
  else sessionStorage.removeItem(secretKey(providerId));
}

export function readLocalCompatibleSecret(providerId: number) {
  return sessionStorage.getItem(secretKey(providerId)) || '';
}

export function clearLocalCompatibleSettings(providerId: number) {
  localStorage.removeItem(settingsKey(providerId));
  sessionStorage.removeItem(secretKey(providerId));
}

export function localCompatibleEndpoint(baseUrl: string, path = 'chat/completions') {
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  const cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath || cleanPath.split('/').includes('..')) throw new Error('local_endpoint_invalid');
  return new URL(cleanPath, base).toString();
}
