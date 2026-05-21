import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { buildPremiumDarkTheme, buildPremiumLightTheme, type AppTheme } from '../theme/premium';

export type Theme = AppTheme;

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  fontsLoaded: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({
  children,
  fontsLoaded = true,
}: {
  children: ReactNode;
  fontsLoaded?: boolean;
}) {
  const [isDark, setIsDark] = useState(true);
  const theme = useMemo(
    () => (isDark ? buildPremiumDarkTheme(fontsLoaded) : buildPremiumLightTheme(fontsLoaded)),
    [isDark, fontsLoaded],
  );
  const value = useMemo(
    () => ({ theme, isDark, fontsLoaded, toggleTheme: () => setIsDark((d) => !d) }),
    [theme, isDark, fontsLoaded],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
