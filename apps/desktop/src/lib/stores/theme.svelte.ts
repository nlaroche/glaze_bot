export type ThemeId = 'deep-space' | 'frost' | 'desert' | 'sunset';

const STORAGE_KEY = 'glazebot-theme';
const DEFAULT_THEME: ThemeId = 'deep-space';

function loadTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'deep-space' || stored === 'frost' || stored === 'desert' || stored === 'sunset') {
      return stored;
    }
  } catch { /* SSR or localStorage unavailable */ }
  return DEFAULT_THEME;
}

function applyTheme(id: ThemeId) {
  try {
    document.documentElement.setAttribute('data-theme', id);
  } catch { /* SSR */ }
}

let currentTheme = $state<ThemeId>(loadTheme());

// Apply on initial load
applyTheme(currentTheme);

export function getTheme(): ThemeId {
  return currentTheme;
}

export function setTheme(id: ThemeId) {
  currentTheme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* localStorage unavailable */ }
  applyTheme(id);
}

export function getThemeStore() {
  return {
    get current() { return currentTheme; },
  };
}
