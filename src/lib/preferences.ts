import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { isToolId, tools, type ToolId } from './tools';

const KEY = 'toolx.preferences.v1';
type Preferences = { favorites: ToolId[]; recent: ToolId[]; theme: 'light' | 'dark' | 'system' };
const defaults: Preferences = { favorites: [], recent: [], theme: 'system' };
let fallback = '';

function read() {
  try { return localStorage.getItem(KEY) ?? fallback; } catch { return fallback; }
}

function parse(raw: string): Preferences {
  try {
    const value = JSON.parse(raw);
    const ids = (items: unknown): ToolId[] => Array.isArray(items)
      ? [...new Set(items.filter((id): id is ToolId => typeof id === 'string' && isToolId(id)))].slice(0, tools.length) : [];
    return {
      favorites: ids(value.favorites),
      recent: ids(value.recent),
      theme: ['light', 'dark', 'system'].includes(value.theme) ? value.theme : 'system',
    };
  } catch { return defaults; }
}

function update(updater: (preferences: Preferences) => Preferences) {
  fallback = JSON.stringify(updater(parse(read())));
  try { localStorage.setItem(KEY, fallback); } catch { /* Keep preferences for this page session. */ }
  window.dispatchEvent(new Event('toolx:preferences'));
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('toolx:preferences', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('toolx:preferences', callback);
  };
}

export function usePreferences() {
  const raw = useSyncExternalStore(subscribe, read);
  const preferences = useMemo(() => parse(raw), [raw]);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = preferences.theme === 'system'
        ? query.matches ? 'dark' : 'light' : preferences.theme;
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [preferences.theme]);
  return {
    ...preferences,
    toggleFavorite: (id: ToolId) => update((value) => ({
      ...value, favorites: value.favorites.includes(id)
        ? value.favorites.filter((item) => item !== id) : [...value.favorites, id],
    })),
    recordUse: (id: ToolId) => update((value) => ({ ...value, recent: [id, ...value.recent.filter((item) => item !== id)].slice(0, tools.length) })),
    clearRecent: () => update((value) => ({ ...value, recent: [] })),
    toggleTheme: () => update((value) => ({
      ...value, theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',
    })),
  };
}
