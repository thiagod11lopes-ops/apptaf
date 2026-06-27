import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { buildPremiumDarkTheme, buildPremiumLightTheme, type AppTheme } from '../theme/premium';
import {
  hydrateAppMetaFromIndexedDb,
  readAppMetaCache,
  THEME_META_KEY,
  writeAppMetaSync,
} from '../offline-first/db/appMeta';

export type Theme = AppTheme;
export type ThemeMode = 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  themeMode: ThemeMode;
  fontsLoaded: boolean;
  toggleTheme: () => void;
  alternarTema: () => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function applyDomTheme(mode: ThemeMode) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

export function ThemeProvider({
  children,
  fontsLoaded = true,
}: {
  children: ReactNode;
  fontsLoaded?: boolean;
}) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    void (async () => {
      await hydrateAppMetaFromIndexedDb();
      const stored = readAppMetaCache(THEME_META_KEY);
      if (stored === 'light' || stored === 'dark') {
        setThemeModeState(stored);
      }
    })();
  }, []);

  const isDark = themeMode === 'dark';

  useEffect(() => {
    applyDomTheme(themeMode);
    writeAppMetaSync(THEME_META_KEY, themeMode);
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeModeState((m) => (m === 'dark' ? 'light' : 'dark'));
  }, []);

  const theme = useMemo(
    () => (isDark ? buildPremiumDarkTheme(fontsLoaded) : buildPremiumLightTheme(fontsLoaded)),
    [isDark, fontsLoaded],
  );

  const value = useMemo(
    () => ({
      theme,
      isDark,
      themeMode,
      fontsLoaded,
      toggleTheme,
      alternarTema: toggleTheme,
      setThemeMode,
    }),
    [theme, isDark, themeMode, fontsLoaded, toggleTheme, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
