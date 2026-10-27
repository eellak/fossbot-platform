export const UI_PREFERENCES_STORAGE_KEY = 'fossbot.uiPreferences';

export type UiPreferences = {
  activeMode?: 'light' | 'dark';
  language?: string;
};

export const loadUiPreferences = (): UiPreferences => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY) || '{}');
    return {
      activeMode: stored.activeMode === 'dark' ? 'dark' : stored.activeMode === 'light' ? 'light' : undefined,
      language: typeof stored.language === 'string' && /^(?:gr|[a-z]{2,3}(?:-[A-Z]{2})?)$/.test(stored.language) ? stored.language : undefined,
    };
  } catch {
    return {};
  }
};

export const saveUiPreferences = (preferences: UiPreferences) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Browsers can disable local storage in privacy-restricted contexts.
  }
};
