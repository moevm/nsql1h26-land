import { useEffect, useMemo, useState } from 'react';

import { useUserPrefsStore } from '../stores/userPrefsStore';

type ResolvedTheme = 'light' | 'dark';

const THEME_QUERY = '(prefers-color-scheme: dark)';

function getMatchMedia(): ((query: string) => MediaQueryList) | null {
  if (typeof globalThis.matchMedia !== 'function') {
    return null;
  }

  return globalThis.matchMedia.bind(globalThis);
}

function getSystemTheme(): ResolvedTheme {
  const matchMedia = getMatchMedia();
  if (!matchMedia) {
    return 'dark';
  }

  return matchMedia(THEME_QUERY).matches ? 'dark' : 'light';
}

function resolveTheme(preference: 'system' | 'light' | 'dark', systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference;
}

export function useThemeSync() {
  const themePreference = useUserPrefsStore((state) => state.themePreference);
  const setThemePreference = useUserPrefsStore((state) => state.setThemePreference);

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    const matchMedia = getMatchMedia();
    if (!matchMedia) {
      return;
    }

    const media = matchMedia(THEME_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(media.matches ? 'dark' : 'light');

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveTheme(themePreference, systemTheme),
    [themePreference, systemTheme],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const toggleTheme = () => {
    setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return {
    themePreference,
    resolvedTheme,
    setThemePreference,
    toggleTheme,
    isSystemTheme: themePreference === 'system',
  };
}
